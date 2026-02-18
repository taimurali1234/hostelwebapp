import Stripe from "stripe";
import prisma from "../../../config/prismaClient";
import { PaymentMethod, PaymentStatus, BookingStatus } from "@prisma/client";
import { logger } from "../../../utils/logger";

export interface CreateCheckoutSessionInput {
  bookingId: string;
  amount: number;
}

export interface CreateCheckoutSessionOutput {
  sessionId: string;
  sessionUrl: string;
}

export class StripePaymentService {
  private readonly stripe: Stripe;
  private readonly clientUrl: string;
  private readonly webhookSecret: string;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const clientUrl = process.env.FRONTEND_URL;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    if (!clientUrl) {
      throw new Error("CLIENT_URL is not configured");
    }

    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    }

    this.stripe = new Stripe(secretKey);
    this.clientUrl = clientUrl;
    this.webhookSecret = webhookSecret;
  }

  getWebhookSecret(): string {
    return this.webhookSecret;
  }

  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
  }

  async createCheckoutSession(
    bookingId: string,
    amount: number,
  ): Promise<CreateCheckoutSessionOutput> {
    const unitAmount = Math.round(amount * 100);
    if (unitAmount <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    const bookingOrder = await prisma.bookingOrder.findUnique({
      where: { id: bookingId },
      select: { id: true, status: true },
    });

    if (!bookingOrder) {
      throw new Error("Booking Order not found");
    }

    const existingPayment = await prisma.payment.findUnique({
      where: { bookingOrderId: bookingId },
      select: { id: true, paymentStatus: true, transactionId: true },
    });

    if (existingPayment?.paymentStatus === PaymentStatus.SUCCESS) {
      throw new Error("Payment already completed for this booking");
    }
    const shortId = bookingId.slice(0, 6).toUpperCase();


    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${this.clientUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.clientUrl}/payment-failed?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        bookingId,
      },
      payment_intent_data: {
        metadata: {
          bookingId,
        },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "pkr",
            unit_amount: unitAmount,
            product_data: {
          name: "Hostel Room Booking",
          description: `Order #${shortId}`,
        },
          },
        },
      ],
    });

    if (!session.url) {
      throw new Error("Stripe Checkout Session URL was not returned");
    }

    await prisma.payment.upsert({
      where: { bookingOrderId: bookingId },
      update: {
        transactionId: session.id,
        paymentMethod: PaymentMethod.STRIPE,
        paymentStatus: PaymentStatus.PENDING,
      },
      create: {
        bookingOrderId: bookingId,
        transactionId: session.id,
        paymentMethod: PaymentMethod.STRIPE,
        paymentStatus: PaymentStatus.PENDING,
      },
    });

    logger.info("Stripe checkout session created", {
      bookingId,
      sessionId: session.id,
    });

    return {
      sessionId: session.id,
      sessionUrl: session.url,
    };
  }

  async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const bookingId = session.metadata?.bookingId;
    if (!bookingId) {
      logger.warn("Stripe checkout.session.completed missing bookingId metadata", {
        sessionId: session.id,
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
  // 1️⃣ Update payment
  await tx.payment.upsert({
    where: { bookingOrderId: bookingId },
    update: {
      transactionId: session.id,
      paymentMethod: PaymentMethod.STRIPE,
      paymentStatus: PaymentStatus.SUCCESS,
    },
    create: {
      bookingOrderId: bookingId,
      transactionId: session.id,
      paymentMethod: PaymentMethod.STRIPE,
      paymentStatus: PaymentStatus.SUCCESS,
    },
  });

  // 2️⃣ Update bookingOrder
  await tx.bookingOrder.updateMany({
    where: {
      id: bookingId,
      status: {
        in: [BookingStatus.PENDING, BookingStatus.RESERVED],
      },
    },
    data: { status: BookingStatus.CONFIRMED },
  });

  // ✅ 3️⃣ Update ALL child bookings
  await tx.booking.updateMany({
    where: {
      bookingOrderId: bookingId,
      status: {
        in: [BookingStatus.PENDING, BookingStatus.RESERVED],
      },
    },
    data: { status: BookingStatus.CONFIRMED },
  });
});

    logger.info("Stripe checkout.session.completed processed", {
      bookingId,
      sessionId: session.id,
    });
  }

  async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const bookingId = paymentIntent.metadata?.bookingId;
    if (!bookingId) {
      logger.warn("Stripe payment_intent.payment_failed missing bookingId metadata", {
        paymentIntentId: paymentIntent.id,
      });
      return;
    }

    await prisma.payment.upsert({
      where: { bookingOrderId: bookingId },
      update: {
        transactionId: paymentIntent.id,
        paymentMethod: PaymentMethod.STRIPE,
        paymentStatus: PaymentStatus.FAILED,
      },
      create: {
        bookingOrderId: bookingId,
        transactionId: paymentIntent.id,
        paymentMethod: PaymentMethod.STRIPE,
        paymentStatus: PaymentStatus.FAILED,
      },
    });

    logger.info("Stripe payment_intent.payment_failed processed", {
      bookingId,
      paymentIntentId: paymentIntent.id,
    });
  }

  async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    const bookingIdFromCharge = charge.metadata?.bookingId;
    let bookingId = bookingIdFromCharge;

    if (!bookingId && typeof charge.payment_intent === "string") {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(charge.payment_intent);
      bookingId = paymentIntent.metadata?.bookingId;
    }

    if (!bookingId) {
      logger.warn("Stripe charge.refunded missing bookingId metadata", {
        chargeId: charge.id,
      });
      return;
    }

    await prisma.payment.updateMany({
      where: {
        bookingId,
        paymentStatus: {
          not: PaymentStatus.REFUNDED,
        },
      },
      data: {
        transactionId: charge.id,
        paymentMethod: PaymentMethod.STRIPE,
        paymentStatus: PaymentStatus.REFUNDED,
      },
    });

    logger.info("Stripe charge.refunded processed", {
      bookingId,
      chargeId: charge.id,
    });
  }
}

export default StripePaymentService;
