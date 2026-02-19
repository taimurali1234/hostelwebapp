import Stripe from "stripe";
import prisma from "../../../config/prismaClient";
import { PaymentMethod, PaymentStatus, BookingStatus, Prisma } from "@prisma/client";
import { logger } from "../../../utils/logger";

export interface CreateCheckoutSessionInput {
  bookingId: string;
  amount: number;
}

export interface CreateCheckoutSessionOutput {
  sessionId: string;
  sessionUrl: string;
}

export type PaymentWithBookingOrder = Prisma.PaymentGetPayload<{
  include: {
    bookingOrder: {
      include: {
        bookings: true;
      };
    };
  };
}>;

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
      const bookingOrder = await tx.bookingOrder.findUnique({
        where: { id: bookingId },
        select: { totalAmount: true },
      });

      if (!bookingOrder) {
        throw new Error("Booking Order not found");
      }
  // 1️⃣ Update payment
  await tx.payment.upsert({
    where: { bookingOrderId: bookingId },
    update: {
      transactionId: session.id,
      paymentMethod: PaymentMethod.STRIPE,
      paymentStatus: PaymentStatus.SUCCESS,
      amountPaid: bookingOrder.totalAmount,
    },
    create: {
      bookingOrderId: bookingId,
      transactionId: session.id,
      paymentMethod: PaymentMethod.STRIPE,
      paymentStatus: PaymentStatus.SUCCESS,
      amountPaid: bookingOrder.totalAmount,
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
  // 4) Reduce available seats per room for this paid booking order
const bookings = await tx.booking.findMany({
  where: { bookingOrderId: bookingId },
  select: {
    roomId: true,
    seatsSelected: true, // use your booking seat field (e.g. seatsBooked/quantity)
  },
});

// Group total seats to reduce by room
const seatsByRoom = new Map<string, number>();
for (const booking of bookings) {
  const current = seatsByRoom.get(booking.roomId) ?? 0;
  seatsByRoom.set(booking.roomId, current + booking.seatsSelected);
}

	// Atomic decrement with non-negative guard
	for (const [roomId, seatsToReduce] of seatsByRoom.entries()) {
	  const updated = await tx.room.updateMany({
	    where: {
	      id: roomId,
	      availableSeats: { gte: seatsToReduce }, // prevent going below 0
	    },
	    data: {
	      availableSeats: { decrement: seatsToReduce },
	      bookedSeats: { increment: seatsToReduce },
	    },
	  });

  if (updated.count === 0) {
    throw new Error(`Insufficient available seats for room ${roomId}`);
  }
}
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
        bookingOrderId: bookingId,
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

  async getAllPayments(params?: { skip?: number; take?: number }): Promise<PaymentWithBookingOrder[]> {
    const { skip, take } = params ?? {};

    return prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        bookingOrder: {
          include: {
            bookings: true,
          },
        },
      },
    });
  }

  async deletePaymentById(paymentId: string): Promise<PaymentWithBookingOrder> {
  const existingPayment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      bookingOrder: {
        include: {
          bookings: true,
        },
      },
    },
  });

  if (!existingPayment) {
    throw new Error("PAYMENT_NOT_FOUND");
  }

  if (existingPayment.paymentStatus !== PaymentStatus.PENDING) {
    throw new Error("ONLY_PENDING_PAYMENT_CAN_BE_DELETED");
  }

  const bookingOrderId = existingPayment.bookingOrderId;

  // Use transaction for safety
  return prisma.$transaction(async (tx) => {
    // Capture data before deletion (for response)
    const deletedPaymentData = existingPayment;

    // 1️⃣ Delete bookingOrder (this will cascade bookings)
    await tx.bookingOrder.delete({
      where: { id: bookingOrderId },
    });

    // 2️⃣ Optionally delete payment explicitly (safe even if cascade exists)
    await tx.payment.delete({
      where: { id: paymentId },
    });

    return deletedPaymentData;
  });
}

}

export default StripePaymentService;
