import { Request, Response, NextFunction } from "express";
import { PaymentMethod } from "@prisma/client";
import PaymentService from "./payment.service";
import { EasyPaisaPaymentService } from "./easypaise.service";
import { JazzCashPaymentService } from "./jazzcash.service";
import prisma from "../../config/prismaClient";
import { z } from "zod";

// Validation schemas
const initiatePaymentSchema = z.object({
  bookingId: z.string().uuid(),
  paymentMethod: z.enum(["STRIPE", "EASYPAISA", "PAYPAL"]),
  phoneNumber: z.string().optional(),
  returnUrl: z.string().url().optional(),
});

const verifyPaymentSchema = z.object({
  bookingId: z.string().uuid(),
});

/**
 * POST /payments/initiate
 * Initiate payment for a booking
 */
export const initiatePayment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsedData = initiatePaymentSchema.parse(req.body);
    const { bookingId, paymentMethod, phoneNumber, returnUrl } = parsedData;
    const userId = req.user?.userId;

    // Verify booking exists and belongs to user
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { user: true },
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.userId !== userId && req.user?.role !== "ADMIN") {
      return res.status(403).json({ message: "Not your booking" });
    }

    // Initiate payment
    const paymentResponse = await PaymentService.initiatePayment({
      bookingId,
      amount: booking.totalAmount,
      paymentMethod: paymentMethod as PaymentMethod,
      returnUrl,
      phoneNumber,
    });

    if (!paymentResponse.success) {
      return res.status(400).json({
        message: paymentResponse.message,
        status: paymentResponse.paymentStatus,
      });
    }

    return res.json({
      message: "Payment initiated successfully",
      transactionId: paymentResponse.transactionId,
      paymentUrl: paymentResponse.paymentUrl,
      paymentStatus: paymentResponse.paymentStatus,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /payments/:bookingId
 * Get payment details for a booking
 */
export const getPaymentDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { bookingId } = req.params;

    const payment = await PaymentService.getPaymentDetails(bookingId);

    if (!payment) {
      return res.status(404).json({ message: "Payment record not found" });
    }

    return res.json(payment);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /payments/verify
 * Verify payment status
 */
export const verifyPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsedData = verifyPaymentSchema.parse(req.body);
    const { bookingId } = parsedData;

    const payment = await prisma.payment.findUnique({
      where: { bookingId },
    });

    if (!payment) {
      return res.status(404).json({ message: "Payment record not found" });
    }

    // Verify with payment provider
    const verification = await PaymentService.verifyPaymentStatus(
      payment.transactionId,
      payment.paymentMethod
    );

    return res.json({
      verified: verification.verified,
      status: verification.status,
      transactionId: payment.transactionId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /payments/stripe/webhook
 * Stripe webhook handler
 */
export const stripeWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const event = req.body;

    if (!event || !event.type) {
      return res.status(400).json({ message: "Invalid webhook payload" });
    }

    switch (event.type) {
      case "payment_intent.succeeded":
        const { id: transactionId, metadata } = event.data.object;
        const bookingId = metadata?.bookingId;

        if (bookingId) {
          await PaymentService.handlePaymentSuccess(
            transactionId,
            bookingId,
            PaymentMethod.STRIPE
          );
        }
        break;

      case "payment_intent.payment_failed":
        const failedTxn = event.data.object;
        const failedBookingId = failedTxn.metadata?.bookingId;

        if (failedBookingId) {
          await PaymentService.handlePaymentFailure(
            failedTxn.id,
            failedBookingId,
            PaymentMethod.STRIPE,
            failedTxn.last_payment_error?.message
          );
        }
        break;
    }

    return res.json({ received: true });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /payments/easypaisa/callback
 * EasyPaisa payment callback handler
 */
export const easyPaisaCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const easyPaisaService = new EasyPaisaPaymentService();
    const callbackData = req.body;

    const callbackResult = await easyPaisaService.handleCallback(callbackData);

    if (callbackResult.status === "SUCCESS") {
      // Extract bookingId from transactionId or callback data
      const bookingId = callbackData.bookingId || callbackData.orderId;

      if (bookingId) {
        const result = await PaymentService.handlePaymentSuccess(
          callbackResult.transactionId,
          bookingId,
          PaymentMethod.EASYPAISA
        );

        return res.json({
          success: result.success,
          message: result.message,
        });
      }
    }

    return res.json({
      success: false,
      message: "Payment verification failed",
      status: callbackResult.status,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /payments/jazzcash/callback
 * JazzCash payment callback handler
 */
export const jazzCashCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const jazzCashService = new JazzCashPaymentService();
    const callbackData = req.body;

    const callbackResult = await jazzCashService.handleCallback(callbackData);

    if (callbackResult.status === "SUCCESS") {
      // Extract bookingId from transaction reference
      // JazzCash returns pp_TxnRefNo which should contain booking info
      const refNo = callbackResult.transactionId;
      // Extract bookingId from reference (adjust based on your format)
      const bookingId = refNo?.split("-")[0];

      if (bookingId) {
        const result = await PaymentService.handlePaymentSuccess(
          callbackResult.transactionId,
          bookingId,
          PaymentMethod.PAYPAL // JazzCash uses PAYPAL enum value
        );

        return res.json({
          success: result.success,
          message: result.message,
        });
      }
    }

    return res.json({
      success: false,
      message: "Payment verification failed",
      status: callbackResult.status,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /payments/status/:transactionId
 * Get payment status by transaction ID
 */
export const getPaymentStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { transactionId } = req.params;

    const payment = await prisma.payment.findFirst({
      where: { transactionId },
      include: { booking: true },
    });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    return res.json({
      transactionId: payment.transactionId,
      bookingId: payment.bookingId,
      paymentMethod: payment.paymentMethod,
      paymentStatus: payment.paymentStatus,
      createdAt: payment.createdAt,
      bookingStatus: payment.booking.status,
    });
  } catch (error) {
    next(error);
  }
};
