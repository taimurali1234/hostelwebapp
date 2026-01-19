import { NextFunction, Request, Response } from "express";
import  prisma  from "../../config/prismaClient";
import { BookingType, BookingStatus } from "@prisma/client";
import { createBookingDTO, createBookingSchema, previewBookingDTO, previewBookingSchema, updateBookingDTO, updateBookingSchema } from "./bookingDTOS/booking.dtos";




/**
 * POST /bookings/preview
 * Calculate booking amount before creating booking
 */
export const previewBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedData: previewBookingDTO = previewBookingSchema.parse(req.body);
    const {
      roomId,
      seatsSelected,
      bookingType,
      price,
      couponCode,
    } = parsedData;

    // Basic validation
    if (!roomId || !bookingType) {
      return res.status(400).json({
        success: false,
        message: "roomId and bookingType are required"
      });
    }

    if (seatsSelected <= 0) {
      return res.status(400).json({
        success: false,
        message: "Seats selected must be greater than 0"
      });
    }

    // Fetch room
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        beds: true,
        bookedSeats: true,
        status: true,
      },
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    if (room.status !== "AVAILABLE") {
      return res.status(400).json({
        success: false,
        message: "Room is not available for booking"
      });
    }

    // Calculate available seats
    const availableSeats = room.beds - room.bookedSeats;
    if (availableSeats === 0) {
      return res.status(400).json({
        success: false,
        message: "This room is already fully booked with all seats"
      });
    }

    if (availableSeats < seatsSelected) {
      return res.status(400).json({
        success: false,
        message: `Only ${availableSeats} seat(s) available in this room`
      });
    }

    let baseAmount = 0;

    // Base amount
    if (price) {
      baseAmount = price * seatsSelected;
    }

    // TAX CALCULATION (Dynamic)
    const taxConfig = await prisma.taxConfig.findFirst({
      where: { isActive: true },
      select: { percent: true },
    });

    const taxPercent = taxConfig?.percent ?? 16;
    const tax = Math.floor((baseAmount * taxPercent) / 100);

    // Total before coupon
    let totalAmount = baseAmount + tax;

    // COUPON LOGIC (INLINE)
    let couponDiscount = 0;
    let couponApplied = false;

    if (couponCode) {
      const couponsFromEnv =
        process.env.COUPON_CODES?.split(",").map(c => c.trim()) || [];

      const discountPercent =
        Number(process.env.COUPON_DISCOUNT_PERCENT) || 5;

      if (couponsFromEnv.includes(couponCode)) {
        couponDiscount = Math.floor(
          (totalAmount * discountPercent) / 100
        );

        totalAmount = totalAmount - couponDiscount;
        couponApplied = true;
      }
    }

    return res.status(200).json({
      success: true,
      message: "Booking preview calculated successfully",
      data: {
        baseAmount,
        tax,
        taxPercent,
        couponDiscount,
        couponApplied,
        totalAmount,
      }
    });
  } catch (error) {
    console.error(error);
    if (error instanceof Error && error.message.includes("validation")) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking preview data provided"
      });
    }
    return res.status(500).json({
      success: false,
      message: "Server is currently unavailable. Please try again later."
    });
  }
};



export const createBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "You are not authenticated"
      });
    }

    // Validate request body
    const parsedData: createBookingDTO = createBookingSchema.parse(req.body);

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
    } = parsedData;

    const booking = await prisma.$transaction(async (tx) => {
      // Fetch room
      const room = await tx.room.findUnique({
        where: { id: roomId },
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
      if (availableSeats < seatsSelected) return { error: "INSUFFICIENT_SEATS", status: 400 };

      // Create booking
      const newBooking = await tx.booking.create({
        data: {
          userId,
          roomId,
          bookingType,
          checkIn: new Date(checkIn),
          checkOut: checkOut ? new Date(checkOut) : null,
          baseAmount,
          taxAmount,
          discount,
          seatsSelected,
          totalAmount,
          source,
          status: "PENDING",
        },
      });

      return newBooking;
    });

    if ("error" in booking) {
      const statusCode = booking.status;
      const messages: Record<string, string> = {
        ROOM_NOT_FOUND: "Room not found",
        ROOM_NOT_AVAILABLE: "Room is not available for booking",
        ROOM_FULL: "This room is completely booked",
        INSUFFICIENT_SEATS: "Not enough seats available in this room",
      };
      return res.status(statusCode).json({
        success: false,
        message: messages[booking.error] || "Booking creation failed"
      });
    }

    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: booking
    });
  } catch (error) {
    console.error(error);
    if (error instanceof Error && error.message.includes("validation")) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking data provided"
      });
    }
    return res.status(500).json({
      success: false,
      message: "Server is currently unavailable. Please try again later."
    });
  }
};


export const updateBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const booking = await prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    // USER restrictions
    if (user && user.role === "USER") {
      if (booking.userId !== user.userId) {
        return res.status(403).json({
          success: false,
          message: "You cannot update someone else's booking"
        });
      }

      if (!["PENDING", "RESERVED"].includes(booking.status)) {
        return res.status(400).json({
          success: false,
          message: "Booking cannot be updated after confirmation"
        });
      }

      if (
        req.body.baseAmount !== undefined ||
        req.body.taxAmount !== undefined ||
        req.body.discount !== undefined ||
        req.body.totalAmount !== undefined ||
        req.body.status !== undefined
      ) {
        return res.status(403).json({
          success: false,
          message: "You are not allowed to update pricing or status"
        });
      }
    }

    // Validate body
    const parsedData: updateBookingDTO =
      updateBookingSchema.parse(req.body);

    // Booking type validation
    if (
      parsedData.bookingType === BookingType.SHORT_TERM &&
      !parsedData.checkOut
    ) {
      return res.status(400).json({
        success: false,
        message: "Checkout date is required for short-term bookings"
      });
    }

    // Auto clear checkout when switching to LONG_TERM
    if (parsedData.bookingType === BookingType.LONG_TERM) {
      parsedData.checkOut = null;
    }

    const updatedBooking = await prisma.$transaction(async (tx) => {
      // Seats management logic based on status change

      // Check if status is being changed
      const statusChanging = parsedData.status !== undefined && parsedData.status !== booking.status;
      const wasConfirmed = booking.status === "CONFIRMED";
      const becomingConfirmed = parsedData.status === "CONFIRMED";

      // Case 1: Changing FROM CONFIRMED to something else (PENDING/CANCELLED) → Release seats
      if (statusChanging && wasConfirmed && !becomingConfirmed) {
        await tx.room.update({
          where: { id: booking.roomId },
          data: {
            bookedSeats: {
              decrement: booking.seatsSelected,
            },
          },
        });
      }

      // Case 2: Changing TO CONFIRMED (from non-confirmed) → Book seats
      if (statusChanging && !wasConfirmed && becomingConfirmed) {
        const room = await tx.room.findUnique({
          where: { id: booking.roomId },
          select: {
            beds: true,
            bookedSeats: true,
          },
        });

        if (!room) return { error: "ROOM_NOT_FOUND", status: 404 };

        const availableSeats = room.beds - room.bookedSeats;

        // Check if enough seats available for confirmation
        if (availableSeats < booking.seatsSelected) {
          return { error: "INSUFFICIENT_SEATS", status: 400 };
        }

        // Book the seats
        await tx.room.update({
          where: { id: booking.roomId },
          data: {
            bookedSeats: {
              increment: booking.seatsSelected,
            },
          },
        });
      }

      // Case 3: Still CONFIRMED but seats are changing → Adjust seat difference
      if (!statusChanging && becomingConfirmed && parsedData.seatsSelected !== undefined && parsedData.seatsSelected !== booking.seatsSelected) {
        const seatDiff = parsedData.seatsSelected - booking.seatsSelected;

        const room = await tx.room.findUnique({
          where: { id: booking.roomId },
          select: {
            beds: true,
            bookedSeats: true,
          },
        });

        if (!room) return { error: "ROOM_NOT_FOUND", status: 404 };

        const availableSeats = room.beds - room.bookedSeats;

        // If increasing seats → check availability
        if (seatDiff > 0 && availableSeats < seatDiff) {
          return { error: "INSUFFICIENT_SEATS", status: 400 };
        }

        // Update room seats with the difference
        await tx.room.update({
          where: { id: booking.roomId },
          data: {
            bookedSeats: {
              increment: seatDiff,
            },
          },
        });
      }

      // Booking update
      const data: any = { ...parsedData };

      if (data.checkIn) data.checkIn = new Date(data.checkIn);
      if ("checkOut" in data) {
        data.checkOut = data.checkOut
          ? new Date(data.checkOut)
          : null;
      }

      return tx.booking.update({
        where: { id },
        data,
      });
    });

    if ("error" in updatedBooking) {
      const statusCode = updatedBooking.status;
      const messages: Record<string, string> = {
        ROOM_NOT_FOUND: "Room not found",
        INSUFFICIENT_SEATS: "Not enough seats available to complete this update",
      };
      return res.status(statusCode).json({
        success: false,
        message: messages[updatedBooking.error] || "Update failed"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Booking updated successfully",
      data: updatedBooking
    });
  } catch (error) {
    console.error(error);
    if (error instanceof Error && error.message.includes("validation")) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking data provided"
      });
    }
    return res.status(500).json({
      success: false,
      message: "Server is currently unavailable. Please try again later."
    });
  }
};


export const getSingleBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        room: true,
        user: true,
        payment: true,
      },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Booking fetched successfully",
      data: booking
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server is currently unavailable. Please try again later."
    });
  }
};

export const getAllBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      search = "",
      status = "",
      bookingType = "",
      source = "",
      page = "1",
      limit = "10",
    } = req.query as Record<string, string>;

    const pageNumber = Math.max(Number(page), 1);
    const pageSize = Math.max(Number(limit), 1);
    const skip = (pageNumber - 1) * pageSize;

    // WHERE CLAUSE
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (bookingType) {
      where.bookingType = bookingType;
    }

    if (source) {
      where.source = source;
    }

    if (search) {
      where.OR = [
        {
          user: {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          },
        },
        {
          room: {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
            ],
          },
        },
        {
          id: { contains: search, mode: "insensitive" },
        },
      ];
    }

    // DB QUERIES (PARALLEL)
    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          room: true,
          user: true,
        },
      }),

      prisma.booking.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Bookings fetched successfully",
      data: {
        items: bookings,
        total,
        page: pageNumber,
        limit: pageSize,
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server is currently unavailable. Please try again later."
    });
  }
};


export const deleteBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const booking = await prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    // USER restriction
    if (user && user.role === "USER") {
      if (booking.userId !== user.userId) {
        return res.status(403).json({
          success: false,
          message: "You cannot delete someone else's booking"
        });
      }

      if (!["PENDING", "RESERVED"].includes(booking.status)) {
        return res.status(400).json({
          success: false,
          message: "Confirmed bookings cannot be deleted"
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      // Release seats
      await tx.room.update({
        where: { id: booking.roomId },
        data: {
          bookedSeats: {
            decrement: booking.seatsSelected,
          },
        },
      });

      // Delete booking
      await tx.booking.delete({
        where: { id },
      });
    });

    return res.status(200).json({
      success: true,
      message: "Booking deleted successfully"
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server is currently unavailable. Please try again later."
    });
  }
};
