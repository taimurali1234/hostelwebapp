import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { ApiError } from "../utils/ApiError";

const validate = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
  // safeParse error throw nahi karta balke result object deta hai
  const result = schema.safeParse(req.body);

  if (!result.success) {
    // Zod ke raw errors ko readable format mein convert karna
    const errorMessages = result.error.errors.map((err) => ({
      field: err.path.join("."),
      message: err.message,
    }));

    // Hamari custom ApiError class ko exact validation errors bhej dena
    return next(new ApiError(400, "Validation Failed", errorMessages));
  }

  // Agar data sahi hai to clean data req.body mein daal dein
  req.body = result.data;
  next();
};

export { validate };
