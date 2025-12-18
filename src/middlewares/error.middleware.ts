import { Prisma } from "@prisma/client";
import { NextFunction,Request,Response } from "express";
import { ZodError } from "zod";

export const errorHandler = (err:unknown, req:Request, res:Response, next:NextFunction) => {
  // Zod
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      errors: err.flatten().fieldErrors,
    });
  }

  // Prisma
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002":
        return res.status(409).json({ message: "Duplicate entry" });
      case "P2025":
        return res.status(404).json({ message: "Record not found" });
    }
  }

  // Custom app errors
//   if (err instanceof AppError) {
//     return res.status(err.statusCode).json({
//       message: err.message,
//     });
//   }

  // Fallback
  return res.status(500).json({
    message: "Internal server error",
  });
};

