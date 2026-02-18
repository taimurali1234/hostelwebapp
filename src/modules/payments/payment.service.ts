import prisma from "../../config/prismaClient";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { StripePaymentService } from "./stripe.service";
import { EasyPaisaPaymentService } from "./easypaise.service";
import { JazzCashPaymentService } from "./jazzcash.service";

export interface IPaymentRequest {
  bookingId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  returnUrl?: string;
  notifyUrl?: string;
  phoneNumber?: string; // for EasyPaisa and JazzCash
}

export interface IPaymentResponse {
  success: boolean;
  transactionId: string;
  paymentUrl?: string;
  message: string;
  paymentStatus: PaymentStatus;
}

export class PaymentService {
  private stripeService = new StripePaymentService();
  private easyPaisaService = new EasyPaisaPaymentService();
  private jazzCashService = new JazzCashPaymentService();

  /**
   * Initialize payment based on payment method
   */
  async initiatePayment(paymentRequest: IPaymentRequest): Promise<IPaymentResponse> {
    try {
      const { bookingId, amount, paymentMethod } = paymentRequest;

      // Verify booking exists
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { user: true, room: true },
      });

      if (!booking) {
        return {
          success: false,
          transactionId: "",
          message: "Booking not found",
          paymentStatus: PaymentStatus.FAILED,
        };
      }

      // Check if payment already exists
      const existingPayment = await prisma.payment.findUnique({
        where: { bookingOrderId: bookingId },
      });

      if (existingPayment && existingPayment.paymentStatus === PaymentStatus.SUCCESS) {
        return {
          success: false,
          transactionId: existingPayment.transactionId,
          message: "Payment already completed for this booking",
          paymentStatus: PaymentStatus.SUCCESS,
        };
      }

      let response: IPaymentResponse;

      switch (paymentMethod) {
        case PaymentMethod.STRIPE:
          response = await this.stripeService.createPaymentIntent({
            bookingId,
            amount,
            customerEmail: booking.user.email,
            customerName: booking.user.name,
            returnUrl: paymentRequest.returnUrl,
          });
          break;

        case PaymentMethod.EASYPAISA:
          response = await this.easyPaisaService.initiatePayment({
            bookingId,
            amount,
            phoneNumber: paymentRequest.phoneNumber || booking.user.phone,
            customerName: booking.user.name,
            notifyUrl: paymentRequest.notifyUrl,
          });
          break;

        case PaymentMethod.JAZZCASH:
          // JazzCash as alternative mobile payment
          response = await this.jazzCashService.initiatePayment({
            bookingId,
            amount,
            phoneNumber: paymentRequest.phoneNumber || booking.user.phone,
            customerName: booking.user.name,
            notifyUrl: paymentRequest.notifyUrl,
          });
          break;

        default:
          return {
            success: false,
            transactionId: "",
            message: "Unsupported payment method",
            paymentStatus: PaymentStatus.FAILED,
          };
      }

      return response;
    } catch (error) {
      console.error("Payment initiation error:", error);
      return {
        success: false,
        transactionId: "",
        message: error instanceof Error ? error.message : "Payment initiation failed",
        paymentStatus: PaymentStatus.FAILED,
      };
    }
  }

  /**
   * Handle successful payment - update booking and room status
   */
  async handlePaymentSuccess(
    transactionId: string,
    bookingId: string,
    paymentMethod: PaymentMethod
  ): Promise<{ success: boolean; message: string }> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Update or create payment record
        await tx.payment.upsert({
          where: { bookingOrderId: bookingId },
          update: {
            paymentStatus: PaymentStatus.SUCCESS,
            transactionId,
            paymentMethod,
          },
          create: {
            bookingOrderId: bookingId,
            paymentStatus: PaymentStatus.SUCCESS,
            transactionId,
            paymentMethod,
          },
        });

        // Update booking status to COMPLETED
        const updatedBooking = await tx.booking.update({
          where: { id: bookingId },
          data: {
            status: "COMPLETED",
          },
          include: {
            room: true,
          },
        });

        // Check if room is fully booked and update status
        const room = await tx.room.findUnique({
          where: { id: updatedBooking.roomId },
          select: {
            beds: true,
            bookedSeats: true,
          },
        });

        if (room && room.bookedSeats >= room.beds) {
          // All seats are booked - update room status to BOOKED
          await tx.room.update({
            where: { id: updatedBooking.roomId },
            data: {
              status: "BOOKED",
            },
          });
        }

        return updatedBooking;
      });

      return {
        success: true,
        message: `Payment successful. Booking #${result.id} confirmed.`,
      };
    } catch (error) {
      console.error("Payment success handling error:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to process payment",
      };
    }
  }

  /**
   * Handle failed payment
   */
  async handlePaymentFailure(
    transactionId: string,
    bookingId: string,
    paymentMethod: PaymentMethod,
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await prisma.payment.upsert({
        where: { bookingOrderId: bookingId },
        update: {
          paymentStatus: PaymentStatus.FAILED,
          transactionId,
        },
        create: {
          bookingOrderId: bookingId,
          paymentStatus: PaymentStatus.FAILED,
          transactionId,
          paymentMethod,
        },
      });

      return {
        success: true,
        message: `Payment failed. Reason: ${reason || "Unknown"}`,
      };
    } catch (error) {
      console.error("Payment failure handling error:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to record payment failure",
      };
    }
  }

  /**
   * Get payment details
   */
  async getPaymentDetails(bookingId: string) {
    try {
      const payment = await prisma.payment.findUnique({
        where: { bookingOrderId: bookingId },
        include: {
          bookingOrder: {
            include: {
              user: true,
            },
          },
        },
      });

      return payment;
    } catch (error) {
      console.error("Error fetching payment details:", error);
      return null;
    }
  }

  /**
   * Verify payment status with payment provider
   */
  async verifyPaymentStatus(
    transactionId: string,
    paymentMethod: PaymentMethod
  ): Promise<{
    status: PaymentStatus;
    verified: boolean;
  }> {
    try {
      let status: PaymentStatus;

      switch (paymentMethod) {
        case PaymentMethod.STRIPE:
          status = await this.stripeService.verifyPayment(transactionId);
          break;

        case PaymentMethod.EASYPAISA:
          status = await this.easyPaisaService.verifyPayment(transactionId);
          break;

        case PaymentMethod.JAZZCASH:
          status = await this.jazzCashService.verifyPayment(transactionId);
          break;

        default:
          return {
            status: PaymentStatus.FAILED,
            verified: false,
          };
      }

      return {
        status,
        verified: status === PaymentStatus.SUCCESS,
      };
    } catch (error) {
      console.error("Payment verification error:", error);
      return {
        status: PaymentStatus.FAILED,
        verified: false,
      };
    }
  }
}

export default new PaymentService();
