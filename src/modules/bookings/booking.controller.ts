import { NextFunction, Request, Response } from "express";
import  prisma  from "../../config/prismaClient";
import { BookingType, BookingStatus } from "@prisma/client";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { syncRoomSeats } from "../../utils/SeatManager";
import { logger } from "../../utils/logger";
import { publishToQueue } from "../../utils/rabit/rabit.publisher";

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

export const getBookingOrderDetails = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { orderId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw new ApiError(401, "Unauthorized - User ID not found");
    }

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
      throw new ApiError(404, "Order not found");
    }

    // Verify that the order belongs to the logged-in user
    if (order.userId !== userId) {
      throw new ApiError(403, "Forbidden - You do not have access to this order");
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  }
);

export const getUserOrders = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.userId;
    const {
      search = "",
      status = "",
      page = "1",
      limit = "10",
    } = req.query as Record<string, string>;

    if (!userId) {
      throw new ApiError(401, "Unauthorized - User ID not found");
    }

    const pageNumber = Math.max(Number(page), 1);
    const pageSize = Math.max(Number(limit), 1);
    const skip = (pageNumber - 1) * pageSize;

    // WHERE CLAUSE - Filter by userId and optional filters
    const where: any = {
      userId, // Only get orders belonging to logged-in user
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.orderNumber = { contains: search, mode: "insensitive" };
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

    res.status(200).json({
      success: true,
      message: "Your orders fetched successfully",
      data: {
        items: orders,
        total,
        page: pageNumber,
        limit: pageSize,
      },
    });
  }
);

export const getAllOrders = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

    res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      data: {
        items: orders,
        total,
        page: pageNumber,
        limit: pageSize,
      },
    });
  }
);
export const previewBooking = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { price, couponCode } = req.body;

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
      } else {
        throw new ApiError(400, "This Coupon no more exist or is invalid");
      }
    }
    
    res.status(200).json({
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
  }
);

export const createMultipleBookings = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    if (!userId) {
      throw new ApiError(401, "Unauthorized");
    }

    const { bookings, totalAmount } = req.body;
    if (!Array.isArray(bookings) || bookings.length === 0) {
      throw new ApiError(400, "Bookings required");
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
    await publishToQueue("ORDER.CREATED", {
  userId,
  userRole,
  title: "Order Created",
  audience: "USER",
  severity: "SUCCESS",
  message: `Your order ${result.order.orderNumber} has been created successfully.`,

});

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: {
        orderNumber: result.order.orderNumber,
        orderId: result.order.id,
        bookingIds: result.bookings.map(b => b.id),
      },
    });
  }
);




export const createBooking = asyncHandler(
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
    } = req.body;

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

      if (!room) throw new Error("ROOM_NOT_FOUND");
      if (room.status !== "AVAILABLE") throw new Error("ROOM_NOT_AVAILABLE");

      const availableSeats = room.beds - room.bookedSeats;
      if (availableSeats === 0) throw new Error("ROOM_FULL");
      if (availableSeats < seatsSelected) throw new Error("INSUFFICIENT_SEATS");

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

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: booking
    });
  }
);

export const updateBooking = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const user = req.user;

    /* ---------- Fetch Booking ---------- */
    const booking = await prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new ApiError(404, "Booking not found");
    }

    /* ---------- USER Restrictions ---------- */
    if (user?.role === "USER") {
      if (booking.userId !== user.userId) {
        throw new ApiError(403, "You cannot update someone else's booking");
      }

      if (
        booking.status === "CONFIRMED" ||
        booking.status === "COMPLETED"
      ) {
        if (
          booking.status &&
          ["PENDING", "RESERVED"].includes(booking.status)
        ) {
          throw new ApiError(400, "Confirmed booking cannot go back to pending or reserved");
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
        throw new ApiError(403, "You are not allowed to update pricing or status");
      }
    }

    /* ---------- Validate Body ---------- */
    const parsedData = req.body;

    if (
      booking.status === "CONFIRMED" ||
      booking.status === "COMPLETED"
    ) {
      if (
        parsedData.status &&
        ["PENDING", "RESERVED"].includes(parsedData.status)
      ) {
        throw new ApiError(400, "Confirmed booking cannot go back to pending or reserved");
      }
    }

    if (
      parsedData.bookingType === BookingType.SHORT_TERM &&
      !parsedData.checkOut
    ) {
      throw new ApiError(400, "Checkout date is required for short-term bookings");
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

    res.status(200).json({
      success: true,
      message: "Booking updated successfully",
      data: updatedBooking,
    });
  }
);



export const getSingleBooking = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
      throw new ApiError(404, "Booking not found");
    }

    res.status(200).json({
      success: true,
      message: "Booking fetched successfully",
      data: booking
    });
  }
);

export const getAllBookings = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

    res.status(200).json({
      success: true,
      message: "Bookings fetched successfully",
      data: {
        items: bookings,
        total,
        page: pageNumber,
        limit: pageSize,
      }
    });
  }
);


export const deleteBooking = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const user = req.user;

    const booking = await prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new ApiError(404, "Booking not found");
    }

    // USER restriction
    if (user && user.role === "USER") {
      if (booking.userId !== user.userId) {
        throw new ApiError(403, "You cannot delete someone else's booking");
      }

      if (!["PENDING", "RESERVED"].includes(booking.status)) {
        throw new ApiError(400, "Confirmed bookings cannot be deleted");
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

    res.status(200).json({
      success: true,
      message: "Booking deleted successfully"
    });
  }
);

export const deleteOrder = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { orderId } = req.params;
    const user = req.user;

    const order = await prisma.bookingOrder.findUnique({
      where: { id: orderId },
      include: {
        bookings: true,
      },
    });

    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    // USER restriction - users can only delete their own orders
    if (user && user.role === "USER") {
      if (order.userId !== user.userId) {
        throw new ApiError(403, "You cannot delete someone else's order");
      }

      // Users can only delete PENDING or RESERVED orders
      if (!["PENDING", "RESERVED"].includes(order.status)) {
        throw new ApiError(400, "Only pending or reserved orders can be deleted");
      }
    }

    if (order.status !== "CANCELLED") {
      throw new ApiError(400, "Order must be cancelled before deletion");
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

    res.status(200).json({
      success: true,
      message: "Order deleted successfully",
    });
  }
);

export const updateOrder = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { orderId } = req.params;
    const { status } = req.body;
    const user = req.user;

    /* ---------- Validate Status ---------- */
    const validStatuses: BookingStatus[] = [
      "PENDING",
      "RESERVED",
      "CONFIRMED",
      "COMPLETED",
      "CANCELLED",
    ];

    if (!status || !validStatuses.includes(status)) {
      throw new ApiError(400, `Invalid status. Valid statuses are: ${validStatuses.join(", ")}`);
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
      throw new ApiError(404, "Order not found");
    }

    if (
      order.status === "CONFIRMED" &&
      ["PENDING", "RESERVED"].includes(status)
    ) {
      throw new ApiError(400, "Confirmed order cannot be reverted to pending or reserved");
    }

    /* ---------- USER Restrictions ---------- */
    if (user?.role === "USER" && order.userId !== user.userId) {
      throw new ApiError(403, "You cannot update someone else's order");
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

    res.status(200).json({
      success: true,
      message: "Order updated successfully",
      data: updatedOrder,
    });
  }
);