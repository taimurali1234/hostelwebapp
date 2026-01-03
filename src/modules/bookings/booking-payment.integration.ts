/**
 * BOOKING + PAYMENT INTEGRATION EXAMPLE
 * 
 * This file shows how to integrate the payment system with the booking system.
 * You can add these functions to your booking.service.ts or create a new service.
 */

import prisma from "../../config/prismaClient";
import { PaymentMethod, BookingStatus } from "@prisma/client";
import PaymentService from "../payments/payment.service";

/**
 * Complete Booking with Payment Flow
 * 
 * This shows the ideal flow when a user wants to:
 * 1. Create a booking
 * 2. Immediately initiate payment
 */
export const createBookingAndInitiatePayment = async (
  userId: string,
  bookingData: {
    roomId: string;
    seatsSelected: number;
    bookingType: "SHORT_TERM" | "LONG_TERM";
    checkIn: Date;
    checkOut?: Date;
    baseAmount: number;
    taxAmount: number;
    discount: number;
    totalAmount: number;
    source: "WEBSITE" | "ADMIN" | "MOBILE";
  },
  paymentData: {
    paymentMethod: PaymentMethod;
    phoneNumber?: string;
    returnUrl?: string;
  }
) => {
  try {
    // Create booking first
    const booking = await prisma.booking.create({
      data: {
        userId,
        roomId: bookingData.roomId,
        seatsSelected: bookingData.seatsSelected,
        bookingType: bookingData.bookingType,
        checkIn: bookingData.checkIn,
        checkOut: bookingData.checkOut || null,
        baseAmount: bookingData.baseAmount,
        taxAmount: bookingData.taxAmount,
        discount: bookingData.discount,
        totalAmount: bookingData.totalAmount,
        source: bookingData.source,
        status: BookingStatus.PENDING,
      },
    });

    // Update room booked seats
    await prisma.room.update({
      where: { id: bookingData.roomId },
      data: {
        bookedSeats: {
          increment: bookingData.seatsSelected,
        },
      },
    });

    // Initiate payment
    const paymentResponse = await PaymentService.initiatePayment({
      bookingId: booking.id,
      amount: bookingData.totalAmount,
      paymentMethod: paymentData.paymentMethod,
      phoneNumber: paymentData.phoneNumber,
      returnUrl: paymentData.returnUrl,
    });

    if (!paymentResponse.success) {
      throw new Error(paymentResponse.message);
    }

    return {
      booking,
      payment: paymentResponse,
    };
  } catch (error) {
    console.error("Error in booking and payment:", error);
    throw error;
  }
};

/**
 * Get Booking with Payment Status
 * 
 * Retrieve a booking along with its payment information
 */
export const getBookingWithPayment = async (bookingId: string) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payment: true,
        room: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!booking) {
      return null;
    }

    return {
      ...booking,
      paymentCompleted: booking.payment?.paymentStatus === "SUCCESS",
      paymentPending: booking.status === "PENDING" && !booking.payment,
    };
  } catch (error) {
    console.error("Error fetching booking with payment:", error);
    return null;
  }
};

/**
 * Cancel Booking and Refund Payment
 * 
 * When a user cancels a booking:
 * 1. Check if payment was successful
 * 2. Process refund if applicable
 * 3. Release booked seats
 * 4. Update booking status
 */
export const cancelBookingWithRefund = async (
  bookingId: string,
  reason?: string
) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true, room: true },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.status === "CANCELLED") {
      throw new Error("Booking is already cancelled");
    }

    const result = await prisma.$transaction(async (tx) => {
      // Release booked seats
      await tx.room.update({
        where: { id: booking.roomId },
        data: {
          bookedSeats: {
            decrement: booking.seatsSelected,
          },
        },
      });

      // Check if room should be marked as AVAILABLE again
      const updatedRoom = await tx.room.findUnique({
        where: { id: booking.roomId },
        select: { beds: true, bookedSeats: true },
      });

      if (updatedRoom && updatedRoom.bookedSeats < updatedRoom.beds) {
        await tx.room.update({
          where: { id: booking.roomId },
          data: {
            status: "AVAILABLE",
          },
        });
      }

      // Update booking status
      const cancelledBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });

      return cancelledBooking;
    });

    // Process refund if payment was successful
    if (booking.payment?.paymentStatus === "SUCCESS") {
      // Call refund function from payment service
      // Example: await PaymentService.refundPayment(booking.payment.transactionId, booking.totalAmount);
      console.log(
        `Refund initiated for booking ${bookingId}: ${booking.totalAmount}`
      );
    }

    return result;
  } catch (error) {
    console.error("Error cancelling booking:", error);
    throw error;
  }
};

/**
 * Get Room Occupancy Status
 * 
 * Check if a room is fully booked and what seats are available
 */
export const getRoomOccupancyStatus = async (roomId: string) => {
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        title: true,
        beds: true,
        bookedSeats: true,
        status: true,
      },
    });

    if (!room) {
      return null;
    }

    const availableSeats = room.beds - room.bookedSeats;
    const isFullyBooked = availableSeats === 0;

    return {
      roomId: room.id,
      roomTitle: room.title,
      totalBeds: room.beds,
      bookedSeats: room.bookedSeats,
      availableSeats,
      isFullyBooked,
      roomStatus: room.status,
      occupancyPercentage: Math.round((room.bookedSeats / room.beds) * 100),
    };
  } catch (error) {
    console.error("Error getting room occupancy:", error);
    return null;
  }
};

/**
 * Get Pending Payments
 * 
 * Get all bookings that have not completed payment
 */
export const getPendingPayments = async (userId?: string) => {
  try {
    const where: any = {
      status: BookingStatus.PENDING,
      payment: {
        is: null,
      },
    };

    if (userId) {
      where.userId = userId;
    }

    const pendingBookings = await prisma.booking.findMany({
      where,
      include: {
        room: {
          select: { id: true, title: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return pendingBookings;
  } catch (error) {
    console.error("Error getting pending payments:", error);
    return [];
  }
};

/**
 * Update Room Status Based on Bookings
 * 
 * This function can be run periodically to ensure room status is accurate
 */
export const updateRoomStatusBasedOnBookings = async () => {
  try {
    const rooms = await prisma.room.findMany({
      select: {
        id: true,
        beds: true,
        bookedSeats: true,
        status: true,
      },
    });

    const updates = rooms.map(async (room) => {
      const shouldBeBooked = room.bookedSeats >= room.beds;
      const currentlyBooked = room.status === "BOOKED";

      if (shouldBeBooked && !currentlyBooked) {
        // Mark as BOOKED
        await prisma.room.update({
          where: { id: room.id },
          data: { status: "BOOKED" },
        });
      } else if (!shouldBeBooked && currentlyBooked) {
        // Mark as AVAILABLE
        await prisma.room.update({
          where: { id: room.id },
          data: { status: "AVAILABLE" },
        });
      }
    });

    await Promise.all(updates);
    console.log("Room statuses updated successfully");
  } catch (error) {
    console.error("Error updating room status:", error);
  }
};

export {};
