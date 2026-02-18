import { Request, Response } from "express";
import { z } from "zod";
import StripePaymentService from "../services/stripe-payment.service";
import prisma from "../../../config/prismaClient";
import { logger } from "../../../utils/logger";

const createCheckoutSessionSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.number().int().positive(),
});

export const createStripeCheckoutSession = async (req: Request, res: Response) => {
  console.log(req.body);
  try {
    const stripePaymentService = new StripePaymentService();
    const { bookingId, amount } = createCheckoutSessionSchema.parse(req.body);

    const bookingOrder = await prisma.bookingOrder.findUnique({
      where: { id: bookingId },
      select: { id: true, userId: true, totalAmount: true },
    });

    if (!bookingOrder) {
      return res.status(404).json({
        success: false,
        message: "Booking Order not found",
      });
    }

    // Optional authorization check when auth middleware is applied to this route.
    if (req.user?.role !== "ADMIN" && req.user?.userId && req.user.userId !== bookingOrder.userId) {
      return res.status(403).json({
        success: false,
        message: "You cannot create a checkout session for this booking",
      });
    }

    if (amount !== bookingOrder.totalAmount) {
      logger.warn("Checkout amount does not match bookingOrder.totalAmount", {
        bookingId,
        requestedAmount: amount,
        bookingTotalAmount: bookingOrder.totalAmount,
      });
      return res.status(400).json({
        success: false,
        message: "Invalid amount for booking",
      });
    }

    const session = await stripePaymentService.createCheckoutSession(
      bookingId,
      amount,
    );

    return res.status(201).json({
      success: true,
      message: "Stripe checkout session created",
      data: {
        sessionId: session.sessionId,
        sessionUrl: session.sessionUrl,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid request payload",
        errors: error.flatten(),
      });
    }

    if (error instanceof Error) {
      if (error.message === "Booking not found") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message === "Payment already completed for this booking") {
        return res.status(409).json({
          success: false,
          message: error.message,
        });
      }
    }

    logger.error("Failed to create Stripe checkout session", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to create checkout session",
    });
  }
};
