import { NextFunction, Request, Response } from "express";
import {
  
  createseatPricingDTO,
  createseatPricingSchema,
  updateseatPricingDTO,
  updateseatPricingSchema,
  
} from "./seatPricingDTOS/seatPricing.dtos";
import prisma from "../../config/prismaClient";
import { tr } from "zod/v4/locales";

export const createSeatPricing = async (req: Request, res: Response) => {
  try {
    const parsedData = createseatPricingSchema.parse(req.body);
    const { roomType, stayType, price, isActive } = parsedData;

    const result = await prisma.$transaction(async (tx) => {
      
      // 1. Deactivate old pricing of same type
      await tx.seatPricing.updateMany({
        where: {
          roomType,
          stayType,
          isActive: true,
        },
        data: { isActive: false },
      });

      // 2. Create new pricing
      const newPricing = await tx.seatPricing.create({
        data: {
          roomType,
          stayType,
          price,
          isActive: true,
        },
      });

      // 3. Update all rooms
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

    return res.status(201).json({
      success: true,
      message: "Seat pricing created and rooms updated",
      data: result,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create seat pricing",
    });
  }
};


// Get all SeatPricings
export const getAllSeatPricing = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomType, stayType, isActive, page = "1", limit = "10", sort = "createdAt_desc" } = req.query;

    // Build where clause
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

    // Parse pagination
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    // Parse sort
    const orderBy: any = {};
    if (sort) {
      const [field, direction] = (sort as string).split("_");
      orderBy[field] = direction === "asc" ? "asc" : "desc";
    } else {
      orderBy.createdAt = "desc";
    }

    // Get total count
    const total = await prisma.seatPricing.count({ where });

    // Get paginated results
    const seatPricings = await prisma.seatPricing.findMany({
      where,
      orderBy,
      skip,
      take: limitNum,
    });

    return res.status(200).json({
      success: true,
      message: "Seat pricings fetched successfully",
      data: {
          seatPricings,
          page: pageNum,
          limit: limitNum,
          total,
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

// Get single SeatPricing by ID
export const getSeatPricingById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const seatPricing = await prisma.seatPricing.findUnique({
      where: { id },
    });

    if (!seatPricing) {
      return res.status(404).json({
        success: false,
        message: "Seat pricing not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Seat pricing fetched successfully",
      data: seatPricing
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server is currently unavailable. Please try again later."
    });
  }
};

// Update SeatPricing
export const updateSeatPricing = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const parsedData = updateseatPricingSchema.parse(req.body);
    const { price, isActive, stayType } = parsedData;

    const updated = await prisma.$transaction(async (tx) => {
      const seatPricing = await tx.seatPricing.findUnique({
        where: { id },
      });

      if (!seatPricing) {
        throw new Error("SeatPricing not found");
      }

      // 1. Deactivate other active pricing (if activating this one)
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

      // 2. Update room prices
      const updateData =
        stayType === "SHORT_TERM"
          ? { shortTermPrice: price }
          : { longTermPrice: price };

      await tx.room.updateMany({
        where: { type: seatPricing.roomType },
        data: updateData,
      });

      // 3. Update seat pricing
      return await tx.seatPricing.update({
        where: { id },
        data: {
          price,
          isActive,
        },
      });
    });

    return res.status(200).json({
      success: true,
      message: "Seat pricing updated and rooms synced",
      data: updated,
    });

  } catch (error) {
    console.error(error);

    if (error instanceof Error && error.message.includes("SeatPricing not found")) {
      return res.status(404).json({
        success: false,
        message: "Seat pricing not found",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server is currently unavailable. Please try again later.",
    });
  }
};

// Delete SeatPricing
export const deleteSeatPricing = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const seatPricing = await prisma.seatPricing.findUnique({
      where: { id },
    });

    if (!seatPricing) {
      return res.status(404).json({
        success: false,
        message: "Seat pricing not found"
      });
    }

    await prisma.seatPricing.delete({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Seat pricing deleted successfully"
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server is currently unavailable. Please try again later."
    });
  }
};


