import { NextFunction, Request, Response } from "express";
import prisma from "../../config/prismaClient";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import redis from "../../config/redis";
import sendEmail from "../../utils/sendEmailLink";
import { sendSuccess, sendCreated, sendBadRequest, sendError, sendNotFound, sendOK, sendInternalServerError, sendForbidden } from "../../utils/response";
import {
  RegisterUserSchema,
  RegisterUserDTO,
  LoginDTO,
  LoginSchema,
  updateDTO,
  updateSchema
} from "../users/DTOs/userRegister.dtos";
import { Role } from "@prisma/client";
import { publishToQueue } from "../../config/rabitmq";
const adminEmails = process.env.ADMIN_EMAILS?.split(",") || [];
const coordinatorEmails = process.env.COORDINATOR_EMAILS?.split(",") || [];

export const registerUser = async (
  req: Request,
  res: Response,
  next:NextFunction
): Promise<Response | void> => {
  try {
    const parsedData: RegisterUserDTO = RegisterUserSchema.parse(req.body);
    const { name, email, password, phone,address } = parsedData;

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
      return sendBadRequest(res, "Email already registered");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        address,
        role:role,
        isVerified: role==="ADMIN" ? true : false ,
      },
    });
    // Generate JWT Token
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing");
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
      sameSite:"lax",
      maxAge: 24 * 60 * 60 * 1000,
    });
    if(user.role !== "ADMIN"){
      try {
        const emailToken = crypto.randomBytes(32).toString("hex");

        // Save token in Redis (1 hour)
        await redis.setex(`verify:${email}`, 3600, emailToken);

        const verificationLink = `${req.protocol}://${req.get(
          "host"
        )}/api/users/verifyEmail?token=${emailToken}&email=${email}`;

        await sendEmail(
          email,
          "Verify your email",
          `<p>Click below to verify your email:</p>
           <a href="${verificationLink}">Verify Email</a>`
        );

        return sendCreated(res, "Registration successful! Please check your email to verify your account.", { userId: user.id, email: user.email });
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
        // Still return success even if email fails, user can resend
        return sendCreated(res, "Registration successful! Email verification link could not be sent. Please use resend email option.", { userId: user.id, email: user.email });
      }
    }
    
    return sendCreated(res, "Admin registered successfully", { userId: user.id, email: user.email, role: user.role });
    
  } catch (error) {
    console.error("Registration error:", error);
    if (error instanceof Error) {
      return sendBadRequest(res, error.message);
    }
    return sendInternalServerError(res, "Registration failed");
  }
};

export const verifyEmail =async (
req:Request,
res:Response,
next:NextFunction
):Promise<Response | void> => {
try {
const { token, email } = req.query as {
token:string;
email:string;
    };

const storedToken =await redis.get(`verify:${email}`);

if (!storedToken || storedToken !== token) {
return sendBadRequest(res, "Invalid or expired verification link", {}, email);
    }

await prisma.user.update({
where: { email },
data: {isVerified:true },
    });
    const user = await prisma.user.findUnique({
      where:{email}
    })
    console.log(user)

// await redis.del(`verify:${email}`);
if(user){
await publishToQueue('AUTH_NOTIFICATION.USER_CREATED', {
                userId: user.id,
                title:"Welocme",
                audience:"USER",
                message: `Welocme ${user.name}. You have been successfully registered with us.`,
            })
}

// Redirect to login page with success query param
return res.redirect(`http://localhost:5173/login?verified=true`);

  }catch (error) {
    console.error("Email verification error:", error);
    if (error instanceof Error) {
      return sendBadRequest(res, error.message);
    }
    return sendInternalServerError(res, "Email verification failed");
  }
};
export const resendVerifyEmail =async (
req:Request,
res:Response,
next:NextFunction
):Promise<Response | void> => {
try {
const { email } = req.body as {
email:string;
    };

 const emailToken = crypto.randomBytes(32).toString("hex");

    // Save token in Redis (1 hour)
    await redis.setex(`verify:${email}`, 3600, emailToken);

    const verificationLink = `${req.protocol}://${req.get(
      "host"
    )}/api/users/verifyEmail?token=${emailToken}&email=${email}`;

    await sendEmail(
      email,
      "Verify your email",
      `<p>Click below to verify your email:</p>
       <a href="${verificationLink}">Verify Email</a>`
    );


 return res.json({
      message: "We have sent the verification email again. Please check your inbox.",
    });
  }catch (error) {
    console.error("Resend verification error:", error);
    if (error instanceof Error) {
      return sendBadRequest(res, error.message);
    }
    return sendInternalServerError(res, "Failed to resend verification email");
  }
};

export const loginUser = async (
  req:Request,
  res:Response,
  next:NextFunction
):Promise<Response | void>=>{

  try {

    const loginParsedData:LoginDTO = LoginSchema.parse(req.body)
    const {email,password} = loginParsedData;
    const user = await prisma.user.findUnique({
      where:{email},
      
    })
    if (!user) {
return sendNotFound(res, "User not found with this email");
    }
    if (!user.isVerified) {
return sendForbidden(res, "Please verify your email first");
    }
const isMatch =await bcrypt.compare(password, user.password);
if (!isMatch) {
return sendBadRequest(res, "Invalid credentials, Wrong Password");
    }
    // Generate JWT Tokens
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing");
    }
    
    // Access Token (1 hour expiration)
    const accessToken = jwt.sign(
      {
        userId: user.id,
        username: user.name,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Refresh Token (1 day expiration)
    const refreshToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    console.log("✅ Access Token generated:", accessToken.substring(0, 20) + "...");
    console.log("✅ Refresh Token generated:", refreshToken.substring(0, 20) + "...");

    // Set Access Token in HTTP-only cookie (1 hour)
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 60 * 60 * 1000, // 1 hour
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
  return sendOK(res, "You are now logged-in", {
    userId:user.id,
    name:user.name,
    email:user.email,
    address:user.address,
    role:user.role,
    
  })

    
  } catch (error) {
    console.error("Login error:", error);
    if (error instanceof Error) {
      return sendBadRequest(res, error.message);
    }
    return sendInternalServerError(res, "Login failed");
  }
}

export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
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

    return res.json({
      users,
      total,
      page: pageNumber,
      limit: pageSize,
    });
  } catch (error) {
    console.error("Get all users error:", error);
    if (error instanceof Error) {
      return sendBadRequest(res, error.message);
    }
    return sendInternalServerError(res, "Failed to fetch users");
  }
};



export const getSingleUser = async (
  req: Request,
  res: Response,
  next:NextFunction
): Promise<Response | void> => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role:true,
        address:true,
        isVerified:true,
        createdAt: true,
      },
    });

    if (!user) {
      return sendNotFound(res, "User not found");
    }
   
    return sendOK(res, "User fetched successfully", user);
  } catch (error) {
    console.error("Get single user error:", error);
    if (error instanceof Error) {
      return sendBadRequest(res, error.message);
    }
    return sendInternalServerError(res, "Failed to fetch user");
  }
};

export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { id } = req.params;

    const parsedData: updateDTO = updateSchema.parse(req.body);

    const { name, phone, address, role, isVerified } = parsedData;

    // 🔐 Authorization
    // if (req.user?.userId !== id && req.user?.role !== "ADMIN") {
    //   return res.status(403).json({ message: "Forbidden" });
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

    return sendOK(res, "User updated successfully", updatedUser);
  } catch (error) {
    console.error("Update user error:", error);
    if (error instanceof Error) {
      return sendBadRequest(res, error.message);
    }
    return sendInternalServerError(res, "Failed to update user");
  }
};

export const deleteUser = async (
  req: Request,
  res: Response,
  next:NextFunction
): Promise<Response | void> => {
  try {
    const { id } = req.params;

    await prisma.user.delete({
      where: { id },
    });

    return sendOK(res, "User deleted successfully");
  } catch (error) {
    console.error("Delete user error:", error);
    if (error instanceof Error) {
      return sendBadRequest(res, error.message);
    }
    return sendInternalServerError(res, "Failed to delete user");
  }
}

/**
 * ✅ Forgot Password - Send reset link to email
 */
export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendBadRequest(res, "Email is required");
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if email exists or not for security
      return sendOK(res, "If the email exists, a password reset link has been sent.");
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
      return sendInternalServerError(res, "Failed to send reset email");
    }

    return sendOK(res, "If the email exists, a password reset link has been sent.");
  } catch (error) {
    console.error("Forgot password error:", error);
    if (error instanceof Error) {
      return sendBadRequest(res, error.message);
    }
    return sendInternalServerError(res, "Failed to process forgot password");
  }
};

/**
 * ✅ Verify Reset Token - Check if token is valid
 */
export const verifyResetToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { token, email } = req.query as { token: string; email: string };

    if (!token || !email) {
      return sendBadRequest(res, "Token and email are required");
    }

    const storedToken = await redis.get(`reset:${email}`);

    if (!storedToken || storedToken !== token) {
      return sendBadRequest(res, "Invalid or expired password reset link");
    }

    return sendOK(res, "Token is valid", { valid: true });
  } catch (error) {
    console.error("Verify reset token error:", error);
    if (error instanceof Error) {
      return sendBadRequest(res, error.message);
    }
    return sendInternalServerError(res, "Failed to verify token");
  }
};

/**
 * ✅ Reset Password - Update password with valid token
 */
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { token, email, newPassword, confirmPassword } = req.body;

    // Validate inputs
    if (!token || !email || !newPassword || !confirmPassword) {
      return sendBadRequest(res, "All fields are required");
    }

    if (newPassword !== confirmPassword) {
      return sendBadRequest(res, "Passwords do not match");
    }

    if (newPassword.length < 6) {
      return sendBadRequest(res, "Password must be at least 6 characters");
    }

    // Verify token
    const storedToken = await redis.get(`reset:${email}`);

    if (!storedToken || storedToken !== token) {
      return sendBadRequest(res, "Invalid or expired password reset link");
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return sendNotFound(res, "User not found");
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

    return sendOK(res, "Password has been reset successfully. Please login with your new password.");
  } catch (error) {
    console.error("Reset password error:", error);
    if (error instanceof Error) {
      return sendBadRequest(res, error.message);
    }
    return sendInternalServerError(res, "Failed to reset password");
  }
};

/**
 * ✅ Refresh Token - Generate new access token using refresh token
 */
export const refreshAccessToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { refreshToken } = req.cookies.refreshToken ? req.cookies : {};
    const userId = req.user?.userId;
    if (!refreshToken) {
      return sendBadRequest(res, "Refresh token is required");
    }

    // Verify refresh token
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing");
    }

    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        // Clear cookies and return token expired error
        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");
        await redis.del(`refreshToken:${error.decoded?.userId}`);
        return sendBadRequest(res, "Session expired. Please login again.");
      }
      return sendBadRequest(res, "Invalid refresh token");
    }

    // Get user from database to fetch latest info
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return sendNotFound(res, "User not found");
    }

    // Verify refresh token in Redis
    const storedRefreshToken = await redis.get(`refreshToken:${user.id}`);
    if (!storedRefreshToken || storedRefreshToken !== refreshToken) {
      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");
      return sendBadRequest(res, "Invalid or expired refresh token. Please login again.");
    }

    // Generate new access token (1 hour)
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

    console.log("✅ New Access Token generated:", newAccessToken.substring(0, 20) + "...");

    // Set new Access Token in HTTP-only cookie
    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    console.log("✅ New access token cookie set successfully");

    return sendOK(res, "Access token refreshed successfully", {
      userId: user.id,
      expiresIn: 3600, // 1 hour in seconds
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    if (error instanceof Error) {
      return sendBadRequest(res, error.message);
    }
    return sendInternalServerError(res, "Failed to refresh token");
  }
};

/**
 * ✅ Logout - Clear tokens and end session
 */
export const logoutUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const userId = req.user?.userId;

    if (userId) {
      // Delete refresh token from Redis
      await redis.del(`refreshToken:${userId}`);
    }

    // Clear cookies
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.clearCookie("token"); // Clear old token cookie if exists

    return sendOK(res, "Logged out successfully");
  } catch (error) {
    console.error("Logout error:", error);
    if (error instanceof Error) {
      return sendBadRequest(res, error.message);
    }
    return sendInternalServerError(res, "Failed to logout");
  }
};

