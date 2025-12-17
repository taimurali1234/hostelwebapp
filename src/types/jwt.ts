import { Role } from "@prisma/client";
import { JwtPayload } from "jsonwebtoken";

export interface CustomJwtPayload extends JwtPayload {
  userId: string,
  userName:string,
  email:string,
  role:Role

}