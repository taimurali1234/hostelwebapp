import { Request, Response,NextFunction } from "express";
import prisma from "../config/prismaClient";
import jwt from "jsonwebtoken";
import { CustomJwtPayload } from "../types/jwt";

const authenticateUser = async (req:Request,res:Response,next:NextFunction):Promise<Response | void> =>{
    const token= req.cookies.accessToken ||req.cookies.refreshToken || req.header('Authorization')?.replace('Bearer ','');
    if(!token){
        return res.status(401).json({message:'Authentication token missing'});
    }
    try{
        if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing");
    }
        const decoded=jwt.verify(token,process.env.JWT_SECRET) as CustomJwtPayload;
        const user=await prisma.user.findUnique({
            where:{id:decoded.userId}
        });
        // console.log("Authenticated user:", user);
        if(!user){
            return res.status(401).json({message:'Invalid token: user not found'});
        }
        req.user={userId:user.id,role:user.role};
        next();
    }
    catch(error){
        return res.status(401).json({message:'Invalid authentication token',error});
    }
}
export default authenticateUser
