import {Request,Response, NextFunction } from "express";
import prisma from "../../config/prismaClient";
import { createReviewDTO, createReviewSchema, updateReviewDTO, updateReviewSchema } from "./reviewDTOS/reviews.dtos";

export const createReview = async (req: Request, res: Response, next: NextFunction) => {
  console.log("api hit")
  try {
    const parsedData:createReviewDTO = createReviewSchema.parse(req.body);
    // let userId = req.user?.userId;
    // if(!userId){
    //   userId= parsedData.userId
    // }

    // if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const { roomId, rating, comment,userId} = parsedData;

    // Optional: check if room exists
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ message: "Room not found" });

    const review = await prisma.review.create({
      data: {
        userId,
        roomId,
        rating,
        comment,
      },
    });

    res.status(201).json({ message: "Review created successfully", review });
  } catch (error) {
    next(error);
  }
};

// Update Review
export const updateReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedData:updateReviewDTO = updateReviewSchema.parse(req.body);
    const { id } = req.params;
    const userId = req.user?.userId;

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) return res.status(404).json({ message: "Review not found" });

    // Ownership check
    // if (review.userId !== userId) {
    //   return res.status(403).json({ message: "Not your review" });
    // }

    const updatedReview = await prisma.review.update({
      where: { id },
      data: parsedData,
    });

    res.status(200).json({ message: "Review updated successfully", review: updatedReview });
  } catch (error) {
    next(error);
  }
};

// Delete Review
export const deleteReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) return res.status(404).json({ message: "Review not found" });

    // if (review.userId !== userId) {
    //   return res.status(403).json({ message: "Not your review" });
    // }

    await prisma.review.delete({ where: { id } });
    res.status(200).json({ message: "Review deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// Get All Reviews for a Room
export const getReviewsForRoom = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract query params
    const {
      skip = "0",         // number of records to skip
      take = "10",        // number of records to take
      sortBy = "createdAt", // field to sort
      order = "desc",     // asc | desc
      minRating,          // optional filter
      maxRating
    } = req.query;
        const { roomId } = req.params;


    // Convert skip & take to numbers
    const skipNum = parseInt(skip as string, 10) || 0;
    const takeNum = parseInt(take as string, 10) || 10;

    // Build where filter
    const where: any = {};
    if (minRating) where.rating = { gte: Number(minRating) };
    if (maxRating) where.rating = { ...where.rating, lte: Number(maxRating) };

    const reviews = await prisma.review.findMany({
      where: {...where, roomId, },
      include: { user: true }, // include user info
      orderBy: { [sortBy as string]: order as "asc" | "desc" },
      skip: skipNum,
      take: takeNum,
    });
    if (!reviews || reviews.length === 0) {
      return res.status(404).json({ message: "No reviews found" });
    }


    res.status(200).json({ reviews });
  } catch (error) {
    next(error);
  }
};

// Get Single Review
export const getReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const review = await prisma.review.findUnique({
      where: { id },
      include: { user: true, room: true },
    });

    if (!review) return res.status(404).json({ message: "Review not found" });

    res.status(200).json({ review });
  } catch (error) {
    next(error);
  }
};

// get all reviews

export const getAllReviews = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      page = "1",
      limit = "10",
      search,
      status,
      rating,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    /* ======================
       WHERE FILTER
    ====================== */
    const where: any = {};

    // ⭐ Exact rating filter (from dropdown)

    if (status) {
  where.status = status;
}

    if (rating) {
      where.rating = Number(rating);
    }

    // 🔍 Search (user name / room title / comment)
    if (search) {
      where.OR = [
        {
          comment: {
            contains: search as string,
            mode: "insensitive",
          },
        },
        {
          user: {
            name: {
              contains: search as string,
              mode: "insensitive",
            },
          },
        },
        {
          room: {
            title: {
              contains: search as string,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    /* ======================
       DB QUERY
    ====================== */
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true },
          },
          room: {
            select: { id: true, title: true },
          },
        },
        orderBy: {
          [sortBy as string]: order === "asc" ? "asc" : "desc",
        },
        skip,
        take: limitNum,
      }),

      prisma.review.count({ where }),
    ]);

    res.status(200).json({
      reviews,
      total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    next(error);
  }
};



