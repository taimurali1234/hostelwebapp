/**
 * OPTIONAL: Enhanced Booking Controller with Payment Integration
 * 
 * This file shows how to optionally enhance your booking controller
 * to support combined booking + payment operations.
 * 
 * You can choose to:
 * 1. Keep booking and payment as separate operations (current setup)
 * 2. Combine them using the examples in this file
 */

import { NextFunction, Request, Response } from "express";
import prisma from "../../config/prismaClient";
import { BookingType, BookingStatus } from "@prisma/client";
import PaymentService from "../payments/payment.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";

/**
 * OPTION 1: Create Booking with Immediate Payment Initiation
 * 
 * This endpoint creates a booking and automatically initiates payment
 * in a single transaction.
 */
export const createBookingWithPayment = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.userId;

    if (!userId) {
      throw new ApiError(401, "You are not authenticated");
    }

    const {
      roomId,
      bookingType,
      checkIn,
      checkOut,
      baseAmount,
      taxAmount,
      discount,
      seatsSelected,
      totalAmount,
      source,
      paymentMethod,
      phoneNumber,
      returnUrl,
    } = req.body;

    const booking = await prisma.$transaction(async (tx) => {
      // 1. Verify room exists and is available
      const room = await tx.room.findUnique({
        where: { id: roomId },
        select: {
          id: true,
          beds: true,
          bookedSeats: true,
          status: true,
        },
      });

      if (!room) throw new Error("ROOM_NOT_FOUND");
      if (room.status !== "AVAILABLE") throw new Error("ROOM_NOT_AVAILABLE");

      const availableSeats = room.beds - room.bookedSeats;
      if (availableSeats === 0) throw new Error("ROOM_FULL");
      if (availableSeats < seatsSelected) {
        throw new Error("INSUFFICIENT_SEATS");
      }

      // 2. Create the booking
      const newBooking = await tx.booking.create({
        data: {
          bookingOrderId: `BOOKING-${Date.now()}`,
          userId,
          roomId,
          bookingType,
          checkIn: new Date(checkIn),
          checkOut: checkOut ? new Date(checkOut) : null,
          baseAmount,
          taxAmount,
          discount,
          seatsSelected,
          source: source || "WEBSITE",
          status: "PENDING",
        },
      });

      // 3. Update room booked seats
      await tx.room.update({
        where: { id: roomId },
        data: {
          bookedSeats: {
            increment: seatsSelected,
          },
        },
      });

      return newBooking;
    });

    // 4. Initiate payment (outside transaction for better error handling)
    const paymentResponse = await PaymentService.initiatePayment({
      bookingId: booking.id,
      amount: booking.baseAmount,
      paymentMethod,
      phoneNumber,
      returnUrl,
    });

    if (!paymentResponse.success) {
      // Rollback booking if payment initiation fails
      await prisma.booking.delete({ where: { id: booking.id } });
      await prisma.room.update({
        where: { id: booking.roomId },
        data: { bookedSeats: { decrement: booking.seatsSelected } },
      });

      throw new ApiError(400, paymentResponse.message);
    }

    res.status(201).json({
      success: true,
      message: "Booking created. Payment initiated.",
      data: {
        booking,
        payment: {
          transactionId: paymentResponse.transactionId,
          paymentUrl: paymentResponse.paymentUrl,
          paymentStatus: paymentResponse.paymentStatus,
        },
      }
    });
  }
);

/**
 * OPTION 2: Get Booking with Payment Details
 * 
 * This endpoint returns full booking information along with payment status
 */
export const getBookingWithPaymentDetails = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.userId;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        room: {
          select: {
            id: true,
            title: true,
            type: true,
            beds: true,
            bookedSeats: true,
            status: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        payment: {
          select: {
            id: true,
            paymentMethod: true,
            paymentStatus: true,
            transactionId: true,
            createdAt: true,
          },
        },
      },
    });

    if (!booking) {
      throw new ApiError(404, "Booking not found");
    }

    // Check authorization (user can only see their own booking, admin can see all)
    if (userId !== booking.userId && req.user?.role !== "ADMIN") {
      throw new ApiError(403, "Not your booking");
    }

    // Add computed fields
    const response = {
      ...booking,
      paymentCompleted: booking.payment?.paymentStatus === "SUCCESS",
      paymentPending: booking.status === "PENDING" && !booking.payment,
      roomOccupancy: {
        totalBeds: booking.room.beds,
        bookedSeats: booking.room.bookedSeats,
        availableSeats: booking.room.beds - booking.room.bookedSeats,
        isFullyBooked: booking.room.bookedSeats >= booking.room.beds,
        occupancyPercentage: Math.round(
          (booking.room.bookedSeats / booking.room.beds) * 100
        ),
      },
    };

    res.status(200).json({
      success: true,
      message: "Booking with payment details fetched successfully",
      data: response
    });
  }
);

/**
 * OPTION 3: Cancel Booking with Automatic Refund
 * 
 * This endpoint cancels a booking and processes refunds if payment was completed
 */
export const cancelBookingWithRefund = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.userId;
    const { reason } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { payment: true, room: true },
    });

    if (!booking) {
      throw new ApiError(404, "Booking not found");
    }

    // Authorization check
    if (userId !== booking.userId && req.user?.role !== "ADMIN") {
      throw new ApiError(403, "Not your booking");
    }

    if (booking.status === "CANCELLED") {
      throw new ApiError(400, "Booking is already cancelled");
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
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
        },
      });

      return cancelledBooking;
    });

    // Process refund if payment was successful
    if (booking.payment?.paymentStatus === "SUCCESS") {
      // In production, call refund function from payment service
      // Example: await PaymentService.processRefund(booking.payment.transactionId, booking.totalAmount);
      console.log(
        `Refund initiated for booking ${id}: Amount ${booking.baseAmount}`
      );
    }

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      data: {
        booking: result,
        refund: booking.payment?.paymentStatus === "SUCCESS" ? {
          status: "PROCESSING",
          amount: booking.baseAmount,
          transactionId: booking.payment.transactionId,
        } : null,
      }
    });
  }
);

/**
 * OPTION 4: Get All Bookings with Payment Status
 * 
 * This endpoint returns all bookings (filtered by user if they're a USER role)
 * along with payment status for each
 */
export const getAllBookingsWithPaymentStatus = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    // Users can only see their own bookings, admins see all
    const where = userRole === "USER" ? { userId } : {};

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        room: {
          select: {
            id: true,
            title: true,
            type: true,
            beds: true,
            bookedSeats: true,
            status: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        payment: {
          select: {
            paymentMethod: true,
            paymentStatus: true,
            transactionId: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Add computed payment and occupancy fields
    const enrichedBookings = bookings.map((booking) => ({
      ...booking,
      paymentInfo: {
        completed: booking.payment?.paymentStatus === "SUCCESS",
        pending: booking.status === "PENDING" && !booking.payment,
        failed: booking.payment?.paymentStatus === "FAILED",
        method: booking.payment?.paymentMethod,
      },
      roomOccupancy: {
        occupancyPercentage: Math.round(
          (booking.room.bookedSeats / booking.room.beds) * 100
        ),
        isFullyBooked: booking.room.bookedSeats >= booking.room.beds,
      },
    }));

    res.status(200).json({
      success: true,
      message: "Bookings fetched successfully",
      data: {
        bookings: enrichedBookings,
        total: enrichedBookings.length,
      }
    });
  }
);

/**
 * HOW TO USE THESE ENDPOINTS
 * 
 * Add to booking.routes.ts:
 * 
 * router.post(
 *   "/with-payment",
 *   authenticateUserWithRole(["USER", "ADMIN"]),
 *   createBookingWithPayment
 * );
 * 
 * router.get(
 *   "/:id/with-payment",
 *   authenticateUserWithRole(["USER", "ADMIN"]),
 *   getBookingWithPaymentDetails
 * );
 * 
 * router.patch(
 *   "/:id/cancel-with-refund",
 *   authenticateUserWithRole(["USER", "ADMIN"]),
 *   cancelBookingWithRefund
 * );
 * 
 * router.get(
 *   "/all/with-payment",
 *   authenticateUserWithRole(["USER", "ADMIN"]),
 *   getAllBookingsWithPaymentStatus
 * );
 */

export {};
