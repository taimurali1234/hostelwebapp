import { z } from "zod";

export const RegisterUserSchema = z.object({
  name: z.string().min(2, "Name too short"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 chars"),
  phone: z.string().regex(/^(0\d{10}|\+?[1-9]\d{9,14})$/, "Invalid phone number"),
  address:z.string().optional()

});
export const LoginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6,"Password must be at least 6 chars"),
});

export const updateSchema = z.object({
  name:z.string().optional(),
  phone: z.string().regex(/^(0\d{10}|\+?[1-9]\d{9,14})$/, "Invalid phone number").optional(),
  address: z.string().optional(),
  role: z.enum(["ADMIN", "USER", "COORDINATOR"]).optional(),
  isVerified: z.boolean().optional(),
})


/**
 * DTO (compile-time type)
 */

export type LoginDTO = z.infer<typeof LoginSchema>;
export type RegisterUserDTO = z.infer<typeof RegisterUserSchema>;
export type updateDTO = z.infer<typeof updateSchema>