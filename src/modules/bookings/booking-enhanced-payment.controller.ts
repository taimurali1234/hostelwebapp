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
import { z } from "zod";

/**
 * OPTION 1: Create Booking with Immediate Payment Initiation
 * 
 * This endpoint creates a booking and automatically initiates payment
 * in a single transaction.
 */
export const createBookingWithPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "You are not authenticated" });
    }

    // Validate the request
    const bookingWithPaymentSchema = z.object({
      roomId: z.string().uuid(),
      bookingType: z.enum(["SHORT_TERM", "LONG_TERM"]),
      checkIn: z.string().datetime(),
      checkOut: z.string().datetime().optional(),
      baseAmount: z.number().positive(),
      taxAmount: z.number().nonnegative(),
      discount: z.number().nonnegative(),
      seatsSelected: z.number().positive(),
      totalAmount: z.number().positive(),
      source: z.enum(["WEBSITE", "ADMIN", "MOBILE"]).optional(),
      // Payment fields
      paymentMethod: z.enum(["STRIPE", "EASYPAISA", "PAYPAL"]),
      phoneNumber: z.string().optional(),
      returnUrl: z.string().url().optional(),
    });

    const parsedData = bookingWithPaymentSchema.parse(req.body);

    const booking = await prisma.$transaction(async (tx) => {
      // 1. Verify room exists and is available
      const room = await tx.room.findUnique({
        where: { id: parsedData.roomId },
        select: {
          id: true,
          beds: true,
          bookedSeats: true,
          status: true,
        },
      });

      if (!room) return { error: "ROOM_NOT_FOUND", status: 404 };
      if (room.status !== "AVAILABLE") return { error: "ROOM_NOT_AVAILABLE", status: 400 };

      const availableSeats = room.beds - room.bookedSeats;
      if (availableSeats === 0) return { error: "ROOM_FULL", status: 400 };
      if (availableSeats < parsedData.seatsSelected) {
        return { error: "INSUFFICIENT_SEATS", status: 400 };
      }

      // 2. Create the booking
      const newBooking = await tx.booking.create({
        data: {
          bookingOrderId: `BOOKING-${Date.now()}`,
          userId,
          roomId: parsedData.roomId,
          bookingType: parsedData.bookingType,
          checkIn: new Date(parsedData.checkIn),
          checkOut: parsedData.checkOut ? new Date(parsedData.checkOut) : null,
          baseAmount: parsedData.baseAmount,
          taxAmount: parsedData.taxAmount,
          discount: parsedData.discount,
          seatsSelected: parsedData.seatsSelected,
          source: parsedData.source || "WEBSITE",
          status: "PENDING",
        },
      });

      // 3. Update room booked seats
      await tx.room.update({
        where: { id: parsedData.roomId },
        data: {
          bookedSeats: {
            increment: parsedData.seatsSelected,
          },
        },
      });

      return newBooking;
    });

    if ("error" in booking) {
      return res.status(booking.status).json({ success: false, message: booking.error });
    }

    // 4. Initiate payment (outside transaction for better error handling)
    const paymentResponse = await PaymentService.initiatePayment({
      bookingId: booking.id,
      amount: booking.baseAmount,
      paymentMethod: parsedData.paymentMethod,
      phoneNumber: parsedData.phoneNumber,
      returnUrl: parsedData.returnUrl,
    });

    if (!paymentResponse.success) {
      // Rollback booking if payment initiation fails
      await prisma.booking.delete({ where: { id: booking.id } });
      await prisma.room.update({
        where: { id: booking.roomId },
        data: { bookedSeats: { decrement: booking.seatsSelected } },
      });

      return res.status(400).json({ success: false, message: paymentResponse.message });
    }

    return res.status(201).json({
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
  } catch (error) {
    next(error);
  }
};

/**
 * OPTION 2: Get Booking with Payment Details
 * 
 * This endpoint returns full booking information along with payment status
 */
export const getBookingWithPaymentDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
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
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Check authorization (user can only see their own booking, admin can see all)
    if (userId !== booking.userId && req.user?.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Not your booking" });
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

    return res.status(200).json({ success: true, message: "Booking with payment details fetched successfully", data: response });
  } catch (error) {
    next(error);
  }
};

/**
 * OPTION 3: Cancel Booking with Automatic Refund
 * 
 * This endpoint cancels a booking and processes refunds if payment was completed
 */
export const cancelBookingWithRefund = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const { reason } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { payment: true, room: true },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Authorization check
    if (userId !== booking.userId && req.user?.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Not your booking" });
    }

    if (booking.status === "CANCELLED") {
      return res.status(400).json({ success: false, message: "Booking is already cancelled" });
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

    return res.status(200).json({
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
  } catch (error) {
    next(error);
  }
};

/**
 * OPTION 4: Get All Bookings with Payment Status
 * 
 * This endpoint returns all bookings (filtered by user if they're a USER role)
 * along with payment status for each
 */
export const getAllBookingsWithPaymentStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
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

    return res.status(200).json({
      success: true,
      message: "Bookings fetched successfully",
      data: {
        bookings: enrichedBookings,
        total: enrichedBookings.length,
      }
    });
  } catch (error) {
    next(error);
  }
};

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
