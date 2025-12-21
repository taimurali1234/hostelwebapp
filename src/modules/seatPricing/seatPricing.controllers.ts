import { NextFunction, Request, Response } from "express";
import {
  
  createseatPricingDTO,
  createseatPricingSchema,
  updateseatPricingDTO,
  updateseatPricingSchema,
  
} from "./seatPricingDTOS/seatPricing.dtos";
import prisma from "../../config/prismaClient";

export const createSeatPricing = async (req: Request, res: Response,next:NextFunction): Promise<Response | void> => {
  try {
    const parsedData:createseatPricingDTO = createseatPricingSchema.parse(req.body)
    const { roomType, price, isActive } = parsedData;

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
        isActive: isActive ?? true,
      },
    });

    res.status(201).json({ message: "Seat pricing created", seatPricing });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong", error });
  }
};

// Get all SeatPricings
export const getAllSeatPricing = async (_req: Request, res: Response,next:NextFunction) => {
  try {
    const seatPricings = await prisma.seatPricing.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(seatPricings);
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
    if (!seatPricing) return res.status(404).json({ message: "Seat pricing not found" });
    res.status(200).json(seatPricing);
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

const { price, isActive } = parsedData;
    const updatedSeatPricing = await prisma.$transaction(async (tx) => {
  // 1️⃣ Get existing seat pricing to know roomType
  const seatPricing = await tx.seatPricing.findUnique({
    where: { id },
    select: { roomType: true },
  });

  if (!seatPricing) {
    throw new Error("SeatPricing not found");
  }

  // 2️⃣ Update price in ALL rooms of that roomType
  await tx.room.updateMany({
    where: {
      type: seatPricing.roomType,
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
    res.status(200).json({ message: "Seat pricing updated", updatedSeatPricing });
  } catch (error) {
    next(error)
  }
};

// Delete SeatPricing
export const deleteSeatPricing = async (req: Request, res: Response,next:NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.seatPricing.delete({ where: { id } });
    res.status(200).json({ message: "Seat pricing deleted" });
  } catch (error) {
    next(error)
  }
};


