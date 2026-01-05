import { NextFunction, Request, Response } from "express";
import  prisma  from "../../config/prismaClient";
import { BookingType, BookingStatus } from "@prisma/client";
import { createBookingDTO, createBookingSchema, previewBookingDTO, previewBookingSchema, updateBookingDTO, updateBookingSchema } from "./bookingDTOS/booking.dtos";
import { sendSuccess, sendCreated, sendBadRequest, sendError, sendNotFound, sendOK, sendInternalServerError, sendUnauthorized, sendForbidden } from "../../utils/response";




/**
 * POST /bookings/preview
 * Calculate booking amount before creating booking
 */
export const previewBooking = async (req: Request, res: Response,next:NextFunction) => {
  try {

    const parsedData:previewBookingDTO = previewBookingSchema.parse(req.body)
    const {
    roomId,
    seatsSelected,
    bookingType,
    price,
    couponCode,
  } = parsedData;

  // 🔐 Basic validation
  if (!roomId || !bookingType) {
    return sendBadRequest(res, "roomId and bookingType are required");
  }

  if (seatsSelected <= 0) {
    return sendBadRequest(res, "Seats selected must be greater than 0");
  }

  // 🏠 Fetch room
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
        return sendNotFound(res, "Room not found");
      }

      if (room.status !== "AVAILABLE") {
        return sendError(res, 500, "Room is not available");
      }

      // 3️⃣ Calculate available seats
      const availableSeats = room.beds - room.bookedSeats;
      console.log(availableSeats)
      if(availableSeats == 0){
        return sendError(res, 500, "This room is already fully booked with all seats");
      }

      if (availableSeats < seatsSelected) {
        return sendError(res, 500, `Only ${availableSeats} seat(s) available in this room`);
      }
  let baseAmount = 0

  // 💰 Base amount
  if(price){
  baseAmount = price * seatsSelected;

  }

  // =============================
  // 📊 TAX CALCULATION (Dynamic)
  // =============================
  const taxConfig = await prisma.taxConfig.findFirst({
    where: { isActive: true },
    select: { percent: true },
  });

  const taxPercent = taxConfig?.percent ?? 16; // default 16%
  const tax = Math.floor((baseAmount * taxPercent) / 100);

  // 🧮 Total before coupon
  let totalAmount = baseAmount + tax;

  // =============================
  // 🎟️ COUPON LOGIC (INLINE)
  // =============================
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

  // 📤 Response (AUTO-FILL data)
  return sendOK(res, "Booking preview calculated", {
    baseAmount,
    tax,
    taxPercent,
    couponDiscount,
    couponApplied,
    totalAmount,
  });
    
  } catch (error) {
    next(error)
    
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
      return sendUnauthorized(res, "You are not authenticated");
    }

    // 1️⃣ Validate request body
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
      // 2️⃣ Fetch room
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

      // 4️⃣ Create booking
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

      // 5️⃣ Update bookedSeats
      // await tx.room.update({
      //   where: { id: roomId },
      //   data: {
      //     bookedSeats: {
      //       increment: seatsSelected,
      //     },
      //   },
      // });

      return newBooking;
    });
    if ("error" in booking) {
  return sendError(res, booking.status, booking.error);
}

    return sendCreated(res, "Booking successfully created", booking);
  } catch (error) {
    next(error);
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
      return sendNotFound(res, "Booking not found");
    }

    // 🧍 USER restrictions
    if (user && user.role === "USER") {
      if (booking.userId !== user.userId) {
        return sendForbidden(res, "Not your booking");
      }

      if (!["PENDING", "RESERVED"].includes(booking.status)) {
        return sendBadRequest(res, "Booking cannot be updated after confirmation");
      }

      if (
        req.body.baseAmount !== undefined ||
        req.body.taxAmount !== undefined ||
        req.body.discount !== undefined ||
        req.body.totalAmount !== undefined ||
        req.body.status !== undefined
      ) {
        return sendForbidden(res, "You are not allowed to update pricing or status");
      }
    }

    // 3️⃣ Validate body
    const parsedData: updateBookingDTO =
      updateBookingSchema.parse(req.body);

    // 4️⃣ Booking type validation
    if (
      parsedData.bookingType === BookingType.SHORT_TERM &&
      !parsedData.checkOut
    ) {
      return sendBadRequest(res, "Checkout required for short term booking");
    }

    if (
      parsedData.bookingType === BookingType.LONG_TERM &&
      parsedData.checkOut
    ) {
      return sendBadRequest(res, "Checkout not allowed for long term booking");
    }

    const updatedBooking = await prisma.$transaction(async (tx) => {
      // 🪑 Seats management logic based on status change
      
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

      // 📝 Booking update
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
  return sendError(res, updatedBooking.status, updatedBooking.error);
}

    return sendOK(res, "Booking updated successfully", updatedBooking);
  } catch (error) {
    next(error);
  }
};


export const getSingleBooking = async (req: Request, res: Response) => {
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
    return sendNotFound(res, "Booking not found");
  }

  return sendOK(res, "Booking fetched successfully", booking);
};

export const getAllBookings = async (req: Request, res: Response) => {
  try {
    // Extract filters from query params
    const { search, status, bookingType, source } = req.query;

    // Build where conditions dynamically
    const where: any = {};

    // Filter by status
    if (status && status !== "") {
      where.status = status;
    }

    // Filter by booking type
    if (bookingType && bookingType !== "") {
      where.bookingType = bookingType;
    }

    // Filter by source
    if (source && source !== "") {
      where.source = source;
    }

    // Filter by search (user name or room name or booking ID)
    if (search && search !== "") {
      where.OR = [
        {
          user: {
            OR: [
              { firstName: { contains: search as string, mode: "insensitive" } },
              { lastName: { contains: search as string, mode: "insensitive" } },
              { email: { contains: search as string, mode: "insensitive" } },
            ],
          },
        },
        {
          room: {
            OR: [
              { title: { contains: search as string, mode: "insensitive" } },
              { name: { contains: search as string, mode: "insensitive" } },
            ],
          },
        },
        {
          id: { contains: search as string, mode: "insensitive" },
        },
      ];
    }

    // Fetch bookings with applied filters
    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        room: true,
        user: true,
      },
    });

    return sendOK(res, "Bookings fetched successfully", bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return sendInternalServerError(res, "Failed to fetch bookings");
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
      return sendNotFound(res, "Booking not found");
    }

    // Optional: USER restriction
    if (user && user.role === "USER") {
      if (booking.userId !== user.userId) {
        return sendForbidden(res, "Not your booking");
      }

      if (!["PENDING", "RESERVED"].includes(booking.status)) {
        return sendBadRequest(res, "Confirmed booking cannot be deleted");
      }
    }

    await prisma.$transaction(async (tx) => {
      // 1️⃣ Release seats
      await tx.room.update({
        where: { id: booking.roomId },
        data: {
          bookedSeats: {
            decrement: booking.seatsSelected,
          },
        },
      });

      // 2️⃣ Delete booking
      await tx.booking.delete({
        where: { id },
      });
    });

    return sendOK(res, "Booking deleted successfully");
  } catch (error) {
    next(error);
  }
};
