import { Request, Response } from "express";
import prisma from "../../config/prismaClient";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import redis from "../../config/redis";
import sendEmail from "../../utils/sendEmailLink";
import {
  RegisterUserSchema,
  RegisterUserDTO,
  LoginDTO,
  LoginSchema,
  updateDTO,
  updateSchema
} from "../users/DTOs/userRegister.dtos";
import { Role } from "@prisma/client";
const adminEmails = process.env.ADMIN_EMAILS?.split(",") || [];
const coordinatorEmails = process.env.COORDINATOR_EMAILS?.split(",") || [];

export const registerUser = async (
  req: Request,
  res: Response
): Promise<Response> => {
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
      return res.status(400).json({ message: "Email already registered" });
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
      const emailToken = crypto.randomBytes(32).toString("hex");

    // Save token in Redis (1 hour)
    await redis.setex(`verify:${email}`, 60, emailToken);

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
      message: "Verification email sent. Please check your inbox.",
    });

    }
    return res.json({message:"You are successfully registered as an Admin"})
    
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const verifyEmail =async (
req:Request,
res:Response
):Promise<Response> => {
try {
const { token, email } = req.query as {
token:string;
email:string;
    };

const storedToken =await redis.get(`verify:${email}`);

if (!storedToken || storedToken !== token) {
return res.status(400).send({message:"Invalid or expired verification link",email});
    }

await prisma.user.update({
where: { email },
data: {isVerified:true },
    });

// await redis.del(`verify:${email}`);

return res.send("✅ Email verified successfully. You can now log in.");
  }catch (error) {
console.error(error);
return res.status(500).send("Server error");
  }
};
export const resendVerifyEmail =async (
req:Request,
res:Response
):Promise<Response> => {
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
console.error(error);
return res.status(500).send("Server error");
  }
};

export const loginUser = async (
  req:Request,
  res:Response
):Promise<Response>=>{

  try {

    const loginParsedData:LoginDTO = LoginSchema.parse(req.body)
    const {email,password} = loginParsedData;
    const user = await prisma.user.findUnique({
      where:{email},
      
    })
    if (!user) {
return res.status(404).json({message:"User not found with this email" });
    }
    if (!user.isVerified) {
return res
        .status(403)
        .json({message:"Please verify your email first" });
    }
const isMatch =await bcrypt.compare(password, user.password);
if (!isMatch) {
return res.status(400).json({message:"Invalid credentials" });
    }
    // Generate JWT Token
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing");
    }
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.name,
        email: user.email,
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
  return res.json({message:"You are now logged-in",data:{userId:user.id,name:user.name,email:user.email,address:user.address}})

    
  } catch (error) {
    return res.status(500).json({message:"Server error" });

  }


}

export const getAllUsers = async (
  req:Request,
  res:Response
):Promise<Response | void>=>{

  try {
    const users = await prisma.user.findMany(
      {
        select:{
          id:true,
          name:true,
          email:true,
          phone:true,
          role:true,
          createdAt:true
        }
      }
    )
    const filteredUsers = users.filter(user=>user.role!=="ADMIN")
    res.json({message:"Fetched all the users successfully",filteredUsers})
    
  } catch (error) {
    res.json({message:"Server Error",error})
  }

}
export const getSingleUser = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(user);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateUser = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { id } = req.params;
    const parsedData:updateDTO = updateSchema.parse(req.body);
    const { name, phone,address }=parsedData

    // Optional: allow only self unless ADMIN
    if (req.user?.userId !== id && req.user?.role !== "ADMIN") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        name,
        phone,
        address
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address:true
      },
    });

    return res.status(201).json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch(error){
return res.status(500).json({
      message: "Server Error",
      error,
    });
  }
}
export const deleteUser = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { id } = req.params;

    await prisma.user.delete({
      where: { id },
    });

    return res.status(200).json({ message: "User deleted successfully" });
  }
  catch(error){
   return res.status(500).json({message:"Server error",error})
  }
}


