import { Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { ApiError } from "../utils/ApiError";
import { logger } from "../utils/logger";

export const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  let statusCode = 500;
  let message = "Internal Server Error";
  let errors: any[] = [];

  // ApiError - Custom application errors
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
    logger.warn(`API Error: ${message}`, { statusCode, path: req.path, method: req.method });
  }
  // ZodError - Validation errors
  else if (err instanceof ZodError) {
    statusCode = 400;
    message = "Validation Failed";
    errors = err.errors.map((err) => ({
      field: err.path.join("."),
      message: err.message,
    }));
    logger.warn(`Validation Error: ${message}`, { path: req.path, fieldCount: errors.length });
  }
  // Prisma errors
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002":
        statusCode = 409;
        message = "Duplicate entry";
        break;
      case "P2025":
        statusCode = 404;
        message = "Record not found";
        break;
      default:
        statusCode = 400;
        message = "Database error";
    }
    logger.error(`Prisma Error [${err.code}]: ${message}`, err);
  }
  // Multer errors - File upload errors
  else if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      statusCode = 400;
      message = "You can upload maximum 5 images only";
    } else if (err.code === "LIMIT_FILE_SIZE") {
      statusCode = 400;
      message = "Each image must be less than 5MB";
    }
    logger.warn(`File Upload Error: ${message}`, { code: err.code });
  }
  // Default error handling for unknown errors
  else if (err instanceof Error) {
    message = err.message;
    logger.error(`Unexpected Error: ${message}`, err);
  } else {
    logger.error(`Unknown Error Type`, undefined, { errorType: typeof err });
  }

  const response = {
    success: false,
    message,
    errors,
    ...(process.env.NODE_ENV === "development" ? { stack: err instanceof Error ? err.stack : "" } : {}), // Security: Production mein stack hide rakhein
  };

  res.status(statusCode).json(response);
};

