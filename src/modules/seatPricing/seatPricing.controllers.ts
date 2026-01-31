import { NextFunction, Request, Response } from "express";
import prisma from "../../config/prismaClient";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";

export const createSeatPricing = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { roomType, stayType, price, isActive } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      await tx.seatPricing.updateMany({
        where: {
          roomType,
          stayType,
          isActive: true,
        },
        data: { isActive: false },
      });

      const newPricing = await tx.seatPricing.create({
        data: {
          roomType,
          stayType,
          price,
          isActive: true,
        },
      });

      const updateData =
        stayType === "SHORT_TERM"
          ? { shortTermPrice: price }
          : { longTermPrice: price };

      await tx.room.updateMany({
        where: { type: roomType },
        data: updateData,
      });

      return newPricing;
    });

    res.status(201).json({
      success: true,
      message: "Seat pricing created and rooms updated",
      data: result,
    });
  }
);


export const getAllSeatPricing = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const {
      roomType,
      stayType,
      isActive,
      page = "1",
      limit = "10",
      sort = "createdAt_desc",
    } = req.query;

    const where: any = {};

    if (roomType) {
      where.roomType = roomType;
    }

    if (stayType) {
      where.stayType = stayType;
    }

    if (isActive !== undefined && isActive !== "") {
      where.isActive = isActive === "true";
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    const orderBy: any = {};
    if (sort) {
      const [field, direction] = (sort as string).split("_");
      orderBy[field] = direction === "asc" ? "asc" : "desc";
    } else {
      orderBy.createdAt = "desc";
    }

    const total = await prisma.seatPricing.count({ where });

    const seatPricings = await prisma.seatPricing.findMany({
      where,
      orderBy,
      skip,
      take: limitNum,
    });

    res.status(200).json({
      success: true,
      message: "Seat pricings fetched successfully",
      data: {
        seatPricings,
        page: pageNum,
        limit: limitNum,
        total,
      },
    });
  }
);

export const getSeatPricingById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;

    const seatPricing = await prisma.seatPricing.findUnique({
      where: { id },
    });

    if (!seatPricing) {
      throw new ApiError(404, "Seat pricing not found");
    }

    res.status(200).json({
      success: true,
      message: "Seat pricing fetched successfully",
      data: seatPricing,
    });
  }
);

export const updateSeatPricing = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const { price, isActive, stayType } = req.body;

    const updated = await prisma.$transaction(async (tx) => {
      const seatPricing = await tx.seatPricing.findUnique({
        where: { id },
      });

      if (!seatPricing) {
        throw new ApiError(404, "Seat pricing not found");
      }

      if (isActive) {
        await tx.seatPricing.updateMany({
          where: {
            roomType: seatPricing.roomType,
            stayType: seatPricing.stayType,
            isActive: true,
            NOT: { id },
          },
          data: { isActive: false },
        });
      }

      const updateData =
        stayType === "SHORT_TERM"
          ? { shortTermPrice: price }
          : { longTermPrice: price };

      await tx.room.updateMany({
        where: { type: seatPricing.roomType },
        data: updateData,
      });

      return await tx.seatPricing.update({
        where: { id },
        data: {
          price,
          isActive,
        },
      });
    });

    res.status(200).json({
      success: true,
      message: "Seat pricing updated and rooms synced",
      data: updated,
    });
  }
);

export const deleteSeatPricing = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;

    const seatPricing = await prisma.seatPricing.findUnique({
      where: { id },
    });

    if (!seatPricing) {
      throw new ApiError(404, "Seat pricing not found");
    }

    await prisma.seatPricing.delete({ where: { id } });

    res.status(200).json({
      success: true,
      message: "Seat pricing deleted successfully",
    });
  }
);


