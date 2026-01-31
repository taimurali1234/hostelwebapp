import { NextFunction, Request, Response } from "express";
import prisma from "../../config/prismaClient";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import redis from "../../config/redis";
import sendEmail from "../../utils/sendEmailLink";
import { logger } from "../../utils/logger";

import { Role } from "@prisma/client";
import { publishToQueue } from "../../config/rabitmq";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { tr } from "zod/v4/locales";

const adminEmails = process.env.ADMIN_EMAILS?.split(",") || [];
const coordinatorEmails = process.env.COORDINATOR_EMAILS?.split(",") || [];

export const registerUser = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { name, email, password, phone, address } = req.body;

  logger.debug("User registration attempt", { email, name });

  let role: Role = "USER";

  // 🔐 Role decision BEFORE DB
  if (adminEmails.includes(email)) {
    role = "ADMIN";
  } else if (coordinatorEmails.includes(email)) {
    role = "COORDINATOR";
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    logger.warn("Registration failed - Email already exists", { email });
    throw new ApiError(400, "Email already registered");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      phone,
      address,
      role: role,
      isVerified: role === "ADMIN" ? true : false,
    },
  });

  logger.info("User created successfully", { userId: user.id, email: user.email, role: user.role });

  // Generate JWT Token
  if (!process.env.JWT_SECRET) {
    logger.error("JWT_SECRET is missing", "JWT configuration error");
    throw new ApiError(500, "JWT_SECRET is missing");
  }

  const token = jwt.sign(
    {
      userId: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  res.cookie("token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000,
  });

  if (user.role !== "ADMIN") {
    try {
      const emailToken = crypto.randomBytes(32).toString("hex");

      // Save token in Redis (1 hour)
      await redis.setex(`verify:${email}`, 3600, emailToken);

const verificationLink = `${req.protocol}://${req.get(
    "host"
  )}/api/users/verifyEmail?token=${emailToken}&email=${email}`;
      await sendEmail(
      email,
      "Verify your email - NeckRest",
      `<h1>Welcome to NeckRest</h1>
       <p>Click the button below to verify your account:</p>
       <a href="${verificationLink}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>`
    );

      logger.success("Verification email sent", { email });

      res.status(201).json({
        success: true,
        message: "Registration successful! Please check your email to verify your account.",
        data: { userId: user.id, email: user.email },
      });
      return;
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      // Still return success even if email fails, user can resend
      res.status(201).json({
        success: true,
        message: "Registration successful! Email verification link could not be sent. Please use resend email option.",
        data: { userId: user.id, email: user.email },
      });
      return;
    }
  }

  res.status(201).json({
    success: true,
    message: "Admin registered successfully",
    data: { userId: user.id, email: user.email, role: user.role },
  });
});

export const verifyEmail = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { token, email } = req.query as {
    token: string;
    email: string;
  };

  if (!token || !email) {
    throw new ApiError(400, "Token and email are required");
  }

  const storedToken = await redis.get(`verify:${email}`);

  if (!storedToken || storedToken !== token) {
    throw new ApiError(400, "Invalid or expired verification link");
  }

  await prisma.user.update({
    where: { email },
    data: { isVerified: true },
  });

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  await publishToQueue("USER.EMAIL_VERIFIED", {
    userId: user.id,
    title: "Welcome",
    audience: "USER",
    severity: "SUCCESS",
    message: `Welcome ${user.name}. You have been successfully registered with us.`,
  });

  // Redirect to login page with success query param
  res.redirect(`${process.env.FRONTEND_URL}/login?verified=true`);
});

export const resendVerifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) throw new ApiError(400, "Email is required");

  // 1. Pehlay check karein kya user exist karta hai? (Important for Security)
  // const user = await User.findOne({ email });
  // if (!user) throw new ApiError(404, "User not found");

  const emailToken = crypto.randomBytes(32).toString("hex");

  // 2. Redis storage
  await redis.setex(`verify:${email}`, 3600, emailToken);

  // 3. Verification Link (Production mein process.env.FRONTEND_URL use karein)
const verificationLink = `${req.protocol}://${req.get(
    "host"
  )}/api/users/verifyEmail?token=${emailToken}&email=${email}`;
  try {
    await sendEmail(
      email,
      "Verify your email - NeckRest",
      `<h1>Welcome to NeckRest</h1>
       <p>Click the button below to verify your account:</p>
       <a href="${verificationLink}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>`
    );

    res.status(200).json({
      success: true,
      message: "Verification email sent. Please check your inbox.",
    });
  } catch (error) {
    // Agar email send na ho sake
    throw new ApiError(500, "Failed to send email. Please try again later.");
  }
});

export const loginUser = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { email, password } = req.body;
  console.log("Login attempt for email:", email);

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new ApiError(404, "User not found with this email");
  }

  if (!user.isVerified) {
    throw new ApiError(403, "Please verify your email first");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new ApiError(400, "Invalid credentials, Wrong Password");
  }

  // Generate JWT Tokens
  if (!process.env.JWT_SECRET) {
    throw new ApiError(500, "JWT_SECRET is missing");
  }

  // Access Token (1 hour expiration)
  const accessToken = jwt.sign(
    {
      userId: user.id,
    username: user.name,
    email: user.email,
    role: user.role,
  },
  process.env.JWT_SECRET!,
  { expiresIn: "1hr" }
);

    // Refresh Token (1 day expiration)
    const refreshToken = jwt.sign(
  {
    userId: user.id,
    email: user.email,
    role: user.role,
  },
  process.env.JWT_SECRET!,
  { expiresIn: "1d" }
);

    console.log("✅ Access Token generated:", accessToken.substring(0, 20) + "...");
    console.log("✅ Refresh Token generated:", refreshToken.substring(0, 20) + "...");

    // Set Access Token in HTTP-only cookie (1 hour)
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 60 * 60 * 1000 , // 1 hour
    });

    // Set Refresh Token in HTTP-only cookie (1 day)
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

  // Also store refresh token in Redis for validation (1 day)
  await redis.setex(`refreshToken:${user.id}`, 24 * 60 * 60, refreshToken);
  console.log("✅ Cookies set successfully");
  res.status(200).json({
    success: true,
    message: "You are now logged-in",
    data: {
      userId: user.id,
      name: user.name,
      email: user.email,
      address: user.address,
      role: user.role,
    },
  });
});

export const getAllUsers = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const {
    search = "",
    role,
    verified,
    page = "1",
    limit = "10",
  } = req.query;

  const pageNumber = Number(page);
  const pageSize = Number(limit);
  const skip = (pageNumber - 1) * pageSize;

  /* =========================
     WHERE CLAUSE (DYNAMIC)
  ========================== */

  const where: any = {
    role: {
      not: "ADMIN", // ❌ always exclude admins
    },
  };

  // 🔍 Search (name, email, phone)
  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: "insensitive" } },
      { email: { contains: search as string, mode: "insensitive" } },
      { phone: { contains: search as string, mode: "insensitive" } },
    ];
  }

  // 🎭 Role filter
  if (role) {
    where.role = role;
  }

  // ✅ Verification filter
  if (verified === "true" || verified === "false") {
    where.isVerified = verified === "true";
  }

  /* =========================
     DB QUERIES
  ========================== */

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
      skip,
      take: pageSize,
      orderBy: {
        createdAt: "desc",
      },
    }),

    prisma.user.count({ where }),
  ]);

  res.status(200).json({
    success: true,
    message: "Users fetched successfully",
    data: {
      users,
      total,
      page: pageNumber,
      limit: pageSize,
    },
  });
});



export const getSingleUser = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      address: true,
      isVerified: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.status(200).json({
    success: true,
    message: "User fetched successfully",
    data: user,
  });
});

export const updateUser = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { id } = req.params;

  const { name, phone, address, role, isVerified } = req.body;

  // 🔐 Authorization
  // if (req.user?.userId !== id && req.user?.role !== "ADMIN") {
  //   throw new ApiError(403, "Forbidden");
  // }

  // 🧠 Build update object safely
  const updateData: any = {};

  if (name !== undefined) updateData.name = name;
  if (phone !== undefined) updateData.phone = phone;
  if (address !== undefined) updateData.address = address;

  // 🔥 Only ADMIN can change these
  if (req.user?.role === "ADMIN") {
    if (role !== undefined) updateData.role = role;
    if (isVerified !== undefined) updateData.isVerified = isVerified;
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      address: true,
      role: true,
      isVerified: true,
    },
  });

  res.status(200).json({
    success: true,
    message: "User updated successfully",
    data: updatedUser,
  });
});

export const deleteUser = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
  const { id } = req.params;
  console.log("Attempting to delete user with ID:", id);

  // 🔐 Authorization
  if (req.user?.role !== "ADMIN") {
    throw new ApiError(403, "Only admins can delete users");
  }

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  await prisma.user.delete({
    where: { id },
  });

  res.status(200).json({
    success: true,
    message: "User deleted successfully",
  });
} catch (error) {
  console.error("Error deleting user:", error);
  throw error; // Re-throw the error to be handled by asyncHandler
}
});

/**
 * ✅ Forgot Password - Send reset link to email
 */
export const forgotPassword = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    // Don't reveal if email exists or not for security
    res.status(200).json({
      success: true,
      message: "If the email exists, a password reset link has been sent.",
    });
    return;
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString("hex");

  // Save token to Redis with 1 hour expiry
  await redis.setex(`reset:${email}`, 3600, resetToken);

  // Build reset link pointing to frontend
  const frontendURL = process.env.FRONTEND_URL || "http://localhost:5173";
  const resetLink = `${frontendURL}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

  // Send email with reset link
  try {
    await sendEmail(
      email,
      "Reset Your Password",
      `<p>Click the link below to reset your password:</p>
       <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
       <p>This link will expire in 1 hour.</p>
       <p>If you didn't request this, please ignore this email.</p>`
    );
  } catch (emailError) {
    console.error("Failed to send reset email:", emailError);
    throw new ApiError(500, "Failed to send reset email");
  }

  res.status(200).json({
    success: true,
    message: "If the email exists, a password reset link has been sent.",
  });
});

/**
 * ✅ Verify Reset Token - Check if token is valid
 */
export const verifyResetToken = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { token, email } = req.query as { token: string; email: string };

  if (!token || !email) {
    throw new ApiError(400, "Token and email are required");
  }

  const storedToken = await redis.get(`reset:${email}`);

  if (!storedToken || storedToken !== token) {
    throw new ApiError(400, "Invalid or expired password reset link");
  }

  res.status(200).json({
    success: true,
    message: "Token is valid",
    data: { valid: true },
  });
});

/**
 * ✅ Reset Password - Update password with valid token
 */
export const resetPassword = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { token, email, newPassword, confirmPassword } = req.body;

  // Validate inputs
  if (!token || !email || !newPassword || !confirmPassword) {
    throw new ApiError(400, "All fields are required");
  }

  if (newPassword !== confirmPassword) {
    throw new ApiError(400, "Passwords do not match");
  }

  if (newPassword.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters");
  }

  // Verify token
  const storedToken = await redis.get(`reset:${email}`);

  if (!storedToken || storedToken !== token) {
    throw new ApiError(400, "Invalid or expired password reset link");
  }

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password in database
  await prisma.user.update({
    where: { email },
    data: { password: hashedPassword },
  });

  // Delete reset token from Redis
  await redis.del(`reset:${email}`);

  res.status(200).json({
    success: true,
    message: "Password has been reset successfully. Please login with your new password.",
  });
});

/**
 * ✅ Refresh Token - Generate new access token using refresh token
 */
export const refreshAccessToken = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    throw new ApiError(401, "Refresh token is required");
  }

  if (!process.env.JWT_SECRET) {
    throw new ApiError(500, "JWT_SECRET is missing");
  }

  let decoded: any;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");
      await redis.del(`refreshToken:${error.decoded?.userId}`);
      throw new ApiError(401, "Session expired. Please login again.");
    }
    throw new ApiError(401, "Invalid refresh token");
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const storedRefreshToken = await redis.get(`refreshToken:${user.id}`);
  if (!storedRefreshToken || storedRefreshToken !== refreshToken) {
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    throw new ApiError(401, "Invalid or expired refresh token. Please login again.");
  }

  const newAccessToken = jwt.sign(
    {
      userId: user.id,
      username: user.name,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  res.cookie("accessToken", newAccessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    maxAge: 60 * 60 * 1000,
  });

  res.status(200).json({
    success: true,
    message: "Access token refreshed successfully",
    data: { userId: user.id, expiresIn: 3600 },
  });
});


/**
 * ✅ Logout - Clear tokens and end session
 */
export const logoutUser = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.user?.userId;

  if (userId) {
    // Delete refresh token from Redis
    await redis.del(`refreshToken:${userId}`);
  }

  // Clear cookies
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.clearCookie("token"); // Clear old token cookie if exists

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

