import { NextFunction, Request, Response } from "express";
import  prisma  from "../../config/prismaClient";
import { BookingType, BookingStatus } from "@prisma/client";
import { createBookingDTO, createBookingSchema, previewBookingDTO, previewBookingSchema, updateBookingDTO, updateBookingSchema } from "./bookingDTOS/booking.dtos";
import { syncRoomSeats } from "../../utils/SeatManager";

/**
 * Helper function to generate order number
 */
const generateOrderNumber = async (tx: any) => {
  const count = await tx.bookingOrder.count();
  const year = new Date().getFullYear();
  return `ORD-${year}-${String(count + 1).padStart(6, "0")}`;
};




/**
 * POST /bookings/preview
 * Calculate booking amount before creating booking
 */

export const getBookingOrderDetails = async (req: Request, res: Response) => {
  const { orderId } = req.params;

  const order = await prisma.bookingOrder.findUnique({
    where: { id: orderId },
    include: {
      bookings: {
        include: {
          room: {
            include: {
              images: true,
              videos: true,
            },
          },
        },
      },
      user: true,
    },
  });

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  return res.status(200).json({
    success: true,
    data: order,
  });
};

export const getAllOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      search = "",
      status = "",
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

    if (search) {
      where.OR = [
        {
          orderNumber: { contains: search, mode: "insensitive" },
        },
        {
          user: {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    // DB QUERIES (PARALLEL)
    const [orders, total] = await Promise.all([
      prisma.bookingOrder.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          bookings: {
            select: {
              id: true,
            },
          },
        },
      }),

      prisma.bookingOrder.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      data: {
        items: orders,
        total,
        page: pageNumber,
        limit: pageSize,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server is currently unavailable. Please try again later.",
    });
  }
};
export const previewBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedData: previewBookingDTO = previewBookingSchema.parse(req.body);
    console.log("Preview booking data:", parsedData);
    const {
      price,
      couponCode,
    } = parsedData;

    const baseAmount = price;
    
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
      else {        return res.status(400).json({
          success: false,
          message: "This Coupon no more exist or is invalid"
        });
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

export const createMultipleBookings = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { bookings,totalAmount } = req.body;
    if (!Array.isArray(bookings) || bookings.length === 0) {
      return res.status(400).json({ success: false, message: "Bookings required" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const orderNumber = await generateOrderNumber(tx);


      // 🟢 CREATE ORDER
      const order = await tx.bookingOrder.create({
        data: {
          userId,
          orderNumber,
          totalAmount,
          status: "PENDING",
        },
      });

      const createdBookings = [];

      for (const booking of bookings) {
        const room = await tx.room.findUnique({
          where: { id: booking.roomId },
          select: { beds: true, bookedSeats: true, status: true },
        });

        if (!room) throw new Error("ROOM_NOT_FOUND");
        if (room.status !== "AVAILABLE") throw new Error("ROOM_NOT_AVAILABLE");

        const availableSeats = room.beds - room.bookedSeats;
        if (availableSeats < booking.seatsSelected) {
          throw new Error("INSUFFICIENT_SEATS");
        }

        const newBooking = await tx.booking.create({
          data: {
            userId,
            roomId: booking.roomId,
            bookingOrderId: order.id,

            bookingType: booking.bookingType,
            checkIn: new Date(booking.checkIn),
            checkOut: booking.checkOut ? new Date(booking.checkOut) : null,

            seatsSelected: booking.seatsSelected,
            baseAmount: booking.baseAmount,
            taxAmount: booking.taxAmount,
            discount: booking.discount,
            couponCode: booking.couponCode,
            source: booking.source,
            status: "PENDING",
          },
        });

        createdBookings.push(newBooking);
      }

      return { order, bookings: createdBookings };
    });

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: {
        orderNumber: result.order.orderNumber,
        orderId: result.order.id,
        bookingIds: result.bookings.map(b => b.id),
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Unable to create booking order",
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
      // Create booking order first
      const orderNumber = await generateOrderNumber(tx);
      const order = await tx.bookingOrder.create({
        data: {
          userId,
          orderNumber,
          totalAmount,
          status: "PENDING",
        },
      });

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
          source,
          status: "PENDING",
          bookingOrderId: order.id,
        },
      });

      return newBooking;
    });

    if ("error" in booking) {
      const statusCode = booking.status as number;
      const messages: Record<string, string> = {
        ROOM_NOT_FOUND: "Room not found",
        ROOM_NOT_AVAILABLE: "Room is not available for booking",
        ROOM_FULL: "This room is completely booked",
        INSUFFICIENT_SEATS: "Not enough seats available in this room",
      };
      return res.status(statusCode).json({
        success: false,
        message: messages[(booking as any).error] || "Booking creation failed"
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
  res: Response
) => {
  try {
    const { id } = req.params;
    const user = req.user;

    /* ---------- Fetch Booking ---------- */
    const booking = await prisma.booking.findUnique({
      where: { id },
    });
    console.log("Fetched booking:", booking);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    /* ---------- USER Restrictions ---------- */
    if (user?.role === "USER") {
      if (booking.userId !== user.userId) {
        return res.status(403).json({
          success: false,
          message: "You cannot update someone else's booking",
        });
      }

     if (
  booking.status === "CONFIRMED" ||
  booking.status === "COMPLETED"
) {
  if (
    booking.status &&
    ["PENDING", "RESERVED"].includes(booking.status)
  ) {
    return res.status(400).json({
      success: false,
      message: "Confirmed booking cannot go back to pending or reserved",
    });
  }
}

      const forbiddenFields = [
        "baseAmount",
        "taxAmount",
        "discount",
        "totalAmount",
        "status",
      ];

      if (forbiddenFields.some(f => req.body[f] !== undefined)) {
        return res.status(403).json({
          success: false,
          message: "You are not allowed to update pricing or status",
        });
      }
    }

    /* ---------- Validate Body ---------- */
    const parsedData = updateBookingSchema.parse(req.body);

    if (
  booking.status === "CONFIRMED" ||
  booking.status === "COMPLETED"
) {
  if (
    parsedData.status &&
    ["PENDING", "RESERVED"].includes(parsedData.status)
  ) {
    return res.status(400).json({
      success: false,
      message: "Confirmed booking cannot go back to pending or reserved",
    });
  }
}

    if (
      parsedData.bookingType === BookingType.SHORT_TERM &&
      !parsedData.checkOut
    ) {
      return res.status(400).json({
        success: false,
        message: "Checkout date is required for short-term bookings",
      });
    }

    if (parsedData.bookingType === BookingType.LONG_TERM) {
      parsedData.checkOut = null;
    }

    /* ---------- Transaction ---------- */
    const updatedBooking = await prisma.$transaction(async (tx) => {
      const newStatus = parsedData.status ?? booking.status;
      if (
  booking.status === "CONFIRMED" ||
  booking.status === "COMPLETED"
) {
  if (
    parsedData.seatsSelected &&
    parsedData.seatsSelected !== booking.seatsSelected
  ) {
    throw new Error("SEATS_CANNOT_BE_CHANGED_AFTER_CONFIRM");
  }
}


      // 🧠 Seat handling (centralized)
      if (parsedData.status) {
        await syncRoomSeats({
          tx,
          roomId: booking.roomId,
          seats: booking.seatsSelected,
          previousStatus: booking.status,
          newStatus,
        });
      }

      const data: any = { ...parsedData };

      if (data.checkIn) data.checkIn = new Date(data.checkIn);
      if ("checkOut" in data) {
        data.checkOut = data.checkOut ? new Date(data.checkOut) : null;
      }

      if (newStatus === "CANCELLED") {
        data.cancelledAt = new Date();
      }

      return tx.booking.update({
        where: { id },
        data,
      });
    });

    return res.status(200).json({
      success: true,
      message: "Booking updated successfully",
      data: updatedBooking,
    });
  } catch (error: any) {
    console.error(error);

    if (error.message === "ROOM_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }
    if (error.message === "SEATS_CANNOT_BE_CHANGED_AFTER_CONFIRM") {
  return res.status(400).json({
    success: false,
    message: "Seats cannot be changed after booking is confirmed",
  });
}

    if (error.message === "ALL_SEATS_BOOKED") {
      return res.status(400).json({
        success: false,
        message:
          "All seats are currently booked. Please wait for seats to be released.",
      });
    }

    if (error instanceof Error && error.message.includes("validation")) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking data provided",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server is currently unavailable. Please try again later.",
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
      orderId = "",
      page = "1",
      limit = "10",
    } = req.query as Record<string, string>;

    const pageNumber = Math.max(Number(page), 1);
    const pageSize = Math.max(Number(limit), 1);
    const skip = (pageNumber - 1) * pageSize;

    // WHERE CLAUSE
    const where: any = {};

    // Filter by orderId if provided
    if (orderId) {
      where.bookingOrderId = orderId;
    }

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
          bookingOrder: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              totalAmount: true,
            },
          },
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

/**
 * DELETE /orders/:orderId
 * Delete a booking order
 */
export const deleteOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const user = req.user;

    const order = await prisma.bookingOrder.findUnique({
      where: { id: orderId },
      include: {
        bookings: true,
      },
    });
console
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // USER restriction - users can only delete their own orders
    if (user && user.role === "USER") {
      if (order.userId !== user.userId) {
        return res.status(403).json({
          success: false,
          message: "You cannot delete someone else's order",
        });
      }

      // Users can only delete PENDING or RESERVED orders
      if (!["PENDING", "RESERVED"].includes(order.status)) {
        return res.status(400).json({
          success: false,
          message: "Only pending or reserved orders can be deleted",
        });
      }
    }
    if (order.status !== "CANCELLED") {
  return res.status(400).json({
    success: false,
    message: "Order must be cancelled before deletion",
  });
}


    // Delete order and associated bookings in a transaction
    await prisma.$transaction(async (tx) => {
      // Release seats for each booking in the order
     for (const booking of order.bookings) {
  const wasConfirmed =
    booking.status === "CONFIRMED" ||
    booking.status === "COMPLETED";

  if (!wasConfirmed) continue; // 🔥 IMPORTANT

  await tx.room.update({
    where: { id: booking.roomId },
    data: {
      bookedSeats: { decrement: booking.seatsSelected },
      availableSeats: { increment: booking.seatsSelected },
      status: "AVAILABLE",
    },
  });
}


      // Delete all bookings in the order
      await tx.booking.deleteMany({
        where: { bookingOrderId: orderId },
      });

      // Delete the order
      await tx.bookingOrder.delete({
        where: { id: orderId },
      });
    });

    return res.status(200).json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server is currently unavailable. Please try again later.",
    });
  }
};

/**
 * PATCH /orders/:orderId
 * Update a booking order status
 */

export const updateOrder = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const user = req.user;
    console.log("Update order status to:", status); 

    /* ---------- Validate Status ---------- */
    const validStatuses: BookingStatus[] = [
      "PENDING",
      "RESERVED",
      "CONFIRMED",
      "COMPLETED",
      "CANCELLED",
    ];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Valid statuses are: ${validStatuses.join(", ")}`,
      });
    }

    /* ---------- Fetch Order ---------- */
    const order = await prisma.bookingOrder.findUnique({
      where: { id: orderId },
      include: {
        bookings: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    if (
  order.status === "CONFIRMED" &&
  ["PENDING", "RESERVED"].includes(status)
) {
  return res.status(400).json({
    success: false,
    message: "Confirmed order cannot be reverted to pending or reserved",
  });
}


    /* ---------- USER Restrictions ---------- */
    if (user?.role === "USER" && order.userId !== user.userId) {
      return res.status(403).json({
        success: false,
        message: "You cannot update someone else's order",
      });
    }

    /* ---------- Transaction ---------- */
    const updatedOrder = await prisma.$transaction(async (tx) => {
      /* ---- Sync seats for each booking ---- */
      for (const booking of order.bookings) {
  await syncRoomSeats({
    tx,
    roomId: booking.roomId,
    seats: booking.seatsSelected,
    previousStatus: booking.status,
    newStatus: status,
  });

  await tx.booking.update({
    where: { id: booking.id },
    data: {
      status,
      cancelledAt: status === "CANCELLED" ? new Date() : null,
    },
  });
}


      /* ---- Update Order ---- */
      return tx.bookingOrder.update({
        where: { id: orderId },
        data: {
          status,
          updatedAt: new Date(),
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          bookings: true,
        },
      });
    });

    return res.status(200).json({
      success: true,
      message: "Order updated successfully",
      data: updatedOrder,
    });
  } catch (error: any) {
    console.error(error);

    if (error.message === "ROOM_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    if (error.message === "ALL_SEATS_BOOKED") {
      return res.status(400).json({
        success: false,
        message:
          "All seats are currently booked. Please wait for seats to be released.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server is currently unavailable. Please try again later.",
    });
  }
};