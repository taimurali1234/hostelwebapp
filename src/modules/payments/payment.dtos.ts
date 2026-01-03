import { z } from "zod";
import { PaymentMethod } from "@prisma/client";

/**
 * Payment DTOs and Validation Schemas
 */

// Initiate Payment DTO
export const initiatePaymentSchema = z.object({
  bookingId: z.string().uuid("Invalid booking ID"),
  paymentMethod: z.enum(["STRIPE", "EASYPAISA", "PAYPAL"], {
    errorMap: () => ({ message: "Invalid payment method" }),
  }),
  phoneNumber: z.string().optional().nullable(),
  returnUrl: z.string().url().optional().nullable(),
});

export type InitiatePaymentDTO = z.infer<typeof initiatePaymentSchema>;

// Verify Payment DTO
export const verifyPaymentSchema = z.object({
  bookingId: z.string().uuid("Invalid booking ID"),
});

export type VerifyPaymentDTO = z.infer<typeof verifyPaymentSchema>;

// Payment Response DTO
export const paymentResponseSchema = z.object({
  success: z.boolean(),
  transactionId: z.string(),
  paymentUrl: z.string().url().optional(),
  message: z.string(),
  paymentStatus: z.enum(["SUCCESS", "FAILED", "PENDING"]),
});

export type PaymentResponseDTO = z.infer<typeof paymentResponseSchema>;

// Payment Status DTO
export const paymentStatusSchema = z.object({
  transactionId: z.string(),
  bookingId: z.string(),
  paymentMethod: z.enum(["STRIPE", "EASYPAISA", "PAYPAL"]),
  paymentStatus: z.enum(["SUCCESS", "FAILED", "PENDING"]),
  createdAt: z.date(),
  bookingStatus: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]),
});

export type PaymentStatusDTO = z.infer<typeof paymentStatusSchema>;

// Webhook Callback DTO
export const webhookCallbackSchema = z.object({
  provider: z.enum(["STRIPE", "EASYPAISA", "JAZZCASH"]),
  transactionId: z.string(),
  bookingId: z.string(),
  status: z.enum(["SUCCESS", "FAILED", "PENDING"]),
  metadata: z.record(z.any()).optional(),
});

export type WebhookCallbackDTO = z.infer<typeof webhookCallbackSchema>;
