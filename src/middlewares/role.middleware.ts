import { Request, Response,NextFunction } from "express";
import prisma from "../config/prismaClient";
import jwt from "jsonwebtoken";
import { CustomJwtPayload } from "../types/jwt";

const authenticateUserWithRole = (roles: string[] = ["USER"])=> async (req:Request,res:Response,next:NextFunction):Promise<Response | void> =>{
    const authHeader = req.header("Authorization");
const token = req.cookies.token ||
             (authHeader && authHeader.split(" ")[0] === "Bearer"
                ? authHeader.split(" ")[1]
                : null);
    if (!token) {
            return res.status(401).json({ message: 'No token provided, authorization denied' });
        }
    try{
        if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing");
    }
        const decoded=jwt.verify(token,process.env.JWT_SECRET) as CustomJwtPayload;
        console.log(decoded)
        if (!roles.includes(decoded.role)) {
                return res.status(403).json({ message: 'Forbidden: You do not have the required permissions' });
            }
            req.user={userId:decoded.userId,role:decoded.role};
            console.log(req.user)
            next();
    }
    catch(error){
        return res.status(401).json({message:'Invalid authentication token',error});
    }
}
export default authenticateUserWithRole
