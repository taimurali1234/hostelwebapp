import { NextFunction, Request, Response } from "express";
import {
  
  createseatPricingDTO,
  createseatPricingSchema,
  updateseatPricingDTO,
  updateseatPricingSchema,
  
} from "./seatPricingDTOS/seatPricing.dtos";
import prisma from "../../config/prismaClient";
import { tr } from "zod/v4/locales";
import { sendSuccess, sendCreated, sendBadRequest, sendError, sendNotFound, sendOK, sendInternalServerError } from "../../utils/response";

export const createSeatPricing = async (req: Request, res: Response,next:NextFunction): Promise<Response | void> => {
  try {
    const parsedData:createseatPricingDTO = createseatPricingSchema.parse(req.body)
    const { roomType, price, isActive,stayType } = parsedData;

    // const existing = await prisma.seatPricing.findUnique({
    //   where: { roomType },
    // });
    // if (existing) {
    //   return res.status(400).json({ message: "Seat pricing for this room type already exists" });
    // }

    const seatPricing = await prisma.seatPricing.create({
      data: {
        roomType,
        price,
        stayType,
        isActive: isActive ?? true,
      },
    });

    sendCreated(res, "Seat pricing created", seatPricing);
  } catch (error) {
    console.error(error);
    sendInternalServerError(res, "Something went wrong");
  }
};

// Get all SeatPricings
export const getAllSeatPricing = async (_req: Request, res: Response,next:NextFunction) => {
  try {
    const seatPricings = await prisma.seatPricing.findMany({
      orderBy: { createdAt: "desc" },
    });
    sendOK(res, "Seat pricings fetched successfully", seatPricings);
  } catch (error) {
    next(error)
  }
};

// Get single SeatPricing by ID
export const getSeatPricingById = async (req: Request, res: Response,next:NextFunction) => {
  try {
    const { id } = req.params;
    const seatPricing = await prisma.seatPricing.findUnique({
      where: { id },
    });
    if (!seatPricing) return sendNotFound(res, "Seat pricing not found");
    sendOK(res, "Seat pricing fetched successfully", seatPricing);
  } catch (error) {
    next(error)
  }
};

// Update SeatPricing
export const updateSeatPricing = async (req: Request, res: Response,next:NextFunction) => {
  try {
    const { id } = req.params;

const parsedData: updateseatPricingDTO =
  updateseatPricingSchema.parse(req.body);

const { price, isActive,stayType } = parsedData;
    const updatedSeatPricing = await prisma.$transaction(async (tx) => {
  // 1️⃣ Get existing seat pricing to know roomType
  const seatPricing = await tx.seatPricing.findUnique({
    where: { id },
    select: { roomType: true,stayType:true },
  });

  if (!seatPricing) {
    throw new Error("SeatPricing not found");
  }

  // 2️⃣ Update price in ALL rooms of that roomType
  await tx.room.updateMany({
    where: {
      type: seatPricing.roomType,
      stayType:seatPricing.stayType
    },
    data: {
      price: price,
    },
  });

  // 3️⃣ Update seat pricing itself
  return await tx.seatPricing.update({
    where: { id },
    data: {
      price,
      isActive,
    },
  });
});
    sendOK(res, "Seat pricing updated", updatedSeatPricing);
  } catch (error) {
    next(error)
  }
};

// Delete SeatPricing
export const deleteSeatPricing = async (req: Request, res: Response,next:NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.seatPricing.delete({ where: { id } });
    sendOK(res, "Seat pricing deleted");
  } catch (error) {
    next(error)
  }
};


