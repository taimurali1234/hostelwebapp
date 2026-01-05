import { Request, Response } from "express";
import prisma from "../../config/prismaClient";
import { BookingStatus, RoomStatus } from "@prisma/client";
import { sendOK, sendError } from "../../utils/response";

export const getDashboardData = async (
  req: Request,
  res: Response
) => {
  try {
    /* ---------------- DATE SETUP ---------------- */
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log("dashboardapihit")
    /* ---------------- TOP SUMMARY CARDS ---------------- */

    // 1️⃣ Today's Booked Rooms
    const todayBookedRooms = await prisma.booking.count({
      where: {
        status: BookingStatus.CONFIRMED,
        createdAt: { gte: today },
      },
    });
    console.log(todayBookedRooms)

    // 2️⃣ Pending Rooms
    const pendingRooms = await prisma.booking.count({
      where: {
        status: BookingStatus.PENDING,
      },
    });

    // 3️⃣ Available Rooms
    const availableRooms = await prisma.room.count({
      where: {
        status: RoomStatus.AVAILABLE,
      },
    });

    // 4️⃣ Total Revenue (from bookings)
    const revenueAgg = await prisma.booking.aggregate({
      _sum: {
        totalAmount: true, // 🔴 must exist in Booking
      },
      where: {
        status: BookingStatus.PENDING,
      },
    });
    console.log(revenueAgg)

    /* ---------------- ROOMS BY TYPE ---------------- */

    const roomsByType = await prisma.room.groupBy({
      by: ["type"],
      _count: { _all: true },
    });

    /* ---------------- ROOM STATUS ---------------- */

    const bookedRooms = await prisma.room.count({
      where: { status: RoomStatus.BOOKED },
    });

    const availableRoomsCount = await prisma.room.count({
      where: { status: RoomStatus.AVAILABLE },
    });

    /* ---------------- BOOKING OVERVIEW (LAST 6 MONTHS) ---------------- */

    const bookings = await prisma.booking.findMany({
  where: { status: BookingStatus.PENDING },
  select: { createdAt: true },
  take:6
});

const monthlyMap: Record<string, number> = {};

bookings.forEach((b) => {
  const month = b.createdAt.toLocaleString("en-US", {
    month: "short",
  });

  monthlyMap[month] = (monthlyMap[month] || 0) + 1;
});

const bookingOverview = Object.entries(monthlyMap)
  .map(([month, count]) => ({ month, count }))
  .slice(0, 6);
  console.log(bookingOverview)


    /* ---------------- RECENT REVIEWS ---------------- */

    const recentReviews = await prisma.review.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        rating: true,
        comment: true,
        user: {
          select: { name: true },
        },
      },
    });

    /* ---------------- FINAL RESPONSE ---------------- */

    return sendOK(res, "Dashboard data loaded successfully", {
      topCards: {
        todayBookedRooms,
        pendingRooms,
        availableRooms,
        totalRevenue: revenueAgg._sum.totalAmount || 0,
      },

      roomsByType,

      roomStatus: {
        booked: bookedRooms,
        available: availableRoomsCount,
      },

      bookingOverview,

      recentReviews,
    });
  } catch (error) {
    console.error("Dashboard Error:", error);
    return sendError(res, 500, "Failed to load dashboard");
  }
};
