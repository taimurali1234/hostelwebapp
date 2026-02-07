import { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      file?: Express.Multer.File;
      files?: Express.Multer.File[];
      user?: {
        userId: string;
        role: Role;
        email: string;
      };
    }
  }
}

export {};
