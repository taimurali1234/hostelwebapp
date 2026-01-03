import { Request, Response, NextFunction } from "express";
import PaymentService from "./payment.service";
import { PaymentMethod } from "@prisma/client";

/**
 * Generic webhook handler for all payment providers
 * Validates and processes payment callbacks
 */
export const handlePaymentWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { provider, transactionId, bookingId, status } = req.body;

    if (!transactionId || !bookingId || !status) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Verify transaction status with payment provider
    let paymentMethod: PaymentMethod = PaymentMethod.STRIPE;
    if (provider === "EASYPAISA") paymentMethod = PaymentMethod.EASYPAISA;
    if (provider === "JAZZCASH") paymentMethod = PaymentMethod.PAYPAL;

    const verification = await PaymentService.verifyPaymentStatus(
      transactionId,
      paymentMethod
    );

    if (verification.verified && status === "SUCCESS") {
      const result = await PaymentService.handlePaymentSuccess(
        transactionId,
        bookingId,
        paymentMethod
      );

      return res.json({
        success: result.success,
        message: result.message,
      });
    } else {
      const result = await PaymentService.handlePaymentFailure(
        transactionId,
        bookingId,
        paymentMethod,
        `Payment status: ${status}`
      );

      return res.json({
        success: result.success,
        message: result.message,
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Health check for webhook endpoints
 */
export const webhookHealthCheck = async (
  req: Request,
  res: Response
) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
};
