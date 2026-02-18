import { Request, Response } from "express";
import Stripe from "stripe";
import StripePaymentService from "../services/stripe-payment.service";
import { logger } from "../../../utils/logger";

export const handleStripeWebhook = async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string") {
    return res.status(400).json({
      success: false,
      message: "Missing Stripe signature",
    });
  }

  if (!Buffer.isBuffer(req.body)) {
    return res.status(400).json({
      success: false,
      message: "Invalid raw body",
    });
  }

  let stripePaymentService: StripePaymentService;
  try {
    stripePaymentService = new StripePaymentService();
  } catch (error) {
    logger.error("Stripe service not configured", error);
    return res.status(500).json({
      success: false,
      message: "Stripe is not configured",
    });
  }

  let event: Stripe.Event;
  try {
    event = stripePaymentService.constructEvent(req.body, signature);
  } catch (error) {
    logger.error("Stripe webhook signature verification failed", error);
    return res.status(400).json({
      success: false,
      message: "Webhook signature verification failed",
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await stripePaymentService.handleCheckoutSessionCompleted(
          event.data.object as unknown as Stripe.Checkout.Session
        );
        break;

      case "payment_intent.payment_failed":
        await stripePaymentService.handlePaymentIntentFailed(
          event.data.object as unknown as Stripe.PaymentIntent
        );
        break;

      case "charge.refunded":
        await stripePaymentService.handleChargeRefunded(
          event.data.object as unknown as Stripe.Charge
        );
        break;

      default:
        logger.debug("Unhandled Stripe webhook event type", { eventType: event.type });
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error("Stripe webhook processing failed", error);
    return res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
};
