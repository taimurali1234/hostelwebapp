import { Request, Response, NextFunction } from "express";
import prisma from "../../config/prismaClient";
import { BookingStatus, RoomStatus } from "@prisma/client";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { logger } from "../../utils/logger";

export const getDashboardData = asyncHandler(
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // Set today's date for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // ============== TOP CARDS DATA ==============

    // 1️⃣ Today's Booked Rooms (CONFIRMED bookings created today)
    const todayBookedRooms = await prisma.booking.count({
      where: {
        status: BookingStatus.CONFIRMED,
        createdAt: { gte: today, lt: tomorrow },
      },
    });

    // 2️⃣ Pending Bookings Count
    const pendingBookingsCount = await prisma.booking.count({
      where: {
        status: BookingStatus.PENDING,
      },
    });

    // 3️⃣ Available Rooms Count
    const availableRoomsCount = await prisma.room.count({
      where: {
        status: RoomStatus.AVAILABLE,
      },
    });

    // 4️⃣ Total Revenue (only from COMPLETED bookings)
    const revenueData = await prisma.booking.aggregate({
      _sum: {
        baseAmount: true,
      },
      where: {
        status: BookingStatus.COMPLETED,
      },
    });

    const totalRevenue = revenueData._sum.baseAmount || 0;

    // ============== BOOKINGS DATA ==============

    // 5️⃣ Pending Bookings (send full details to frontend)
    const pendingBookings = await prisma.booking.findMany({
      where: { status: BookingStatus.PENDING },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
        room: {
          select: {
            id: true,
            title: true,
            type: true,
            floor: true,
            beds: true,
          },
        },
        bookingOrder: {
          select: { id: true, orderNumber: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // 6️⃣ Confirmed Bookings (send full details to frontend)
    const confirmedBookings = await prisma.booking.findMany({
      where: { status: BookingStatus.CONFIRMED },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
        room: {
          select: {
            id: true,
            title: true,
            type: true,
            floor: true,
            beds: true,
          },
        },
        bookingOrder: {
          select: { id: true, orderNumber: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // ============== ROOM OCCUPANCY DATA ==============

    // 7️⃣ Total Occupied Rooms (BOOKED status)
    const occupiedRoomsCount = await prisma.room.count({
      where: { status: RoomStatus.BOOKED },
    });

    // 8️⃣ Seat data by room type (total seats and occupied seats)
    const roomsByType = await prisma.room.groupBy({
      by: ["type"],
      _sum: {
        beds: true,
        bookedSeats: true,
      },
      _count: {
        id: true,
      },
    });

    const seatDataByRoomType = roomsByType.map((room) => ({
      roomType: room.type,
      totalRooms: room._count.id,
      totalSeats: room._sum.beds || 0,
      occupiedSeats: room._sum.bookedSeats || 0,
      availableSeats: (room._sum.beds || 0) - (room._sum.bookedSeats || 0),
    }));

    // ============== FLOOR STATUS ==============

    // 9️⃣ Floor-wise room availability
    const floorStatus = await prisma.room.groupBy({
      by: ["floor"],
      _count: {
        id: true,
      },
      _sum: {
        beds: true,
        bookedSeats: true,
      },
    });

    const floorStatusData = floorStatus.map((floor) => ({
      floorName: floor.floor,
      totalRooms: floor._count.id,
      totalSeats: floor._sum.beds || 0,
      occupiedSeats: floor._sum.bookedSeats || 0,
      availableSeats: (floor._sum.beds || 0) - (floor._sum.bookedSeats || 0),
    }));

    // ============== REVIEWS DATA ==============

    // 🔟 Get recent reviews with user and room details
    const reviews = await prisma.review.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        room: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    });

    // Count reviews by status
    const approvedReviewsCount = await prisma.review.count({
      where: { status: "APPROVED" },
    });

    const pendingReviewsCount = await prisma.review.count({
      where: { status: "PENDING" },
    });

    // ============== RESPONSE ==============

    res.status(200).json({
      success: true,
      message: "Dashboard data loaded successfully",
      data: {
        // Top Cards Summary
        summary: {
          todayBookedRooms,
          pendingBookingsCount,
          availableRoomsCount,
          occupiedRoomsCount,
          totalRevenue,
        },

        // Booking Details
        bookings: {
          pending: {
            count: pendingBookingsCount,
            list: pendingBookings,
          },
          confirmed: {
            count: await prisma.booking.count({
              where: { status: BookingStatus.CONFIRMED },
            }),
            list: confirmedBookings,
          },
        },

        // Room Occupancy Details
        roomOccupancy: {
          totalRooms: await prisma.room.count(),
          availableRooms: availableRoomsCount,
          occupiedRooms: occupiedRoomsCount,
          seatsByRoomType: seatDataByRoomType,
        },

        // Floor Status
        floorStatus: floorStatusData,

        // Reviews Info
        reviews: {
          approvedCount: approvedReviewsCount,
          pendingCount: pendingReviewsCount,
          totalCount: approvedReviewsCount + pendingReviewsCount,
          recentReviews: reviews,
        },
      },
    });
  }
);
