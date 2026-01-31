import { Request, Response, NextFunction } from "express";
import prisma from "../../config/prismaClient";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { logger } from "../../utils/logger";

export const createReview = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { roomId, rating, comment, userId } = req.body;

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new ApiError(404, "Room not found");

    const review = await prisma.review.create({
      data: {
        userId,
        roomId,
        rating,
        comment,
      },
    });

    res.status(201).json({
      success: true,
      message: "Review created successfully",
      data: review,
    });
  }
);

export const updateReview = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) throw new ApiError(404, "Review not found");

    const updatedReview = await prisma.review.update({
      where: { id },
      data: req.body,
    });

    res.status(200).json({
      success: true,
      message: "Review updated successfully",
      data: updatedReview,
    });
  }
);

export const deleteReview = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) throw new ApiError(404, "Review not found");

    await prisma.review.delete({ where: { id } });

    res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  }
);

export const getReviewsForRoom = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const {
      skip = "0",
      take = "10",
      sortBy = "createdAt",
      order = "desc",
      minRating,
      maxRating,
    } = req.query;
    const { roomId } = req.params;

    const skipNum = parseInt(skip as string, 10) || 0;
    const takeNum = parseInt(take as string, 10) || 10;

    const where: any = {};
    if (minRating) where.rating = { gte: Number(minRating) };
    if (maxRating) where.rating = { ...where.rating, lte: Number(maxRating) };

    const reviews = await prisma.review.findMany({
      where: { ...where, roomId },
      include: { user: true },
      orderBy: { [sortBy as string]: order as "asc" | "desc" },
      skip: skipNum,
      take: takeNum,
    });

    if (!reviews || reviews.length === 0) {
      throw new ApiError(404, "No reviews found");
    }

    res.status(200).json({
      success: true,
      message: "Reviews fetched successfully",
      data: { reviews },
    });
  }
);

export const getReview = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;

    const review = await prisma.review.findUnique({
      where: { id },
      include: { user: true, room: true },
    });

    if (!review) throw new ApiError(404, "Review not found");

    res.status(200).json({
      success: true,
      message: "Review fetched successfully",
      data: { review },
    });
  }
);

export const getAllReviews = asyncHandler(
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
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

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (rating) {
      where.rating = Number(rating);
    }

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
      success: true,
      message: "All reviews fetched successfully",
      data: {
        reviews,
        total,
        page: pageNum,
        limit: limitNum,
      },
    });
  }
);



