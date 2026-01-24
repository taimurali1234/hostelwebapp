import { NextFunction, Request, Response } from "express";
import {
  createRoomDTO,
  createRoomSchema,
  updateRoomDTO,
  updateRoomSchema,
} from "./RoomDTOS/room.dtos";
import prisma from "../../config/prismaClient";
import { deleteFromS3 } from "../../utils/uploadToS3";
import constants from "constants";
import { calculateRoomSeats, validateBedsUpdate } from "../../utils/roomSeatManager";

export const createRoom = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const parsedData: createRoomDTO = createRoomSchema.parse(req.body);
    const { title, type, floor, beds, washrooms, description } = parsedData;

    // Fetch both SHORT_TERM and LONG_TERM pricing
    const shortTermPricing = await prisma.seatPricing.findFirst({
      where: {
        roomType: type,
        stayType: "SHORT_TERM",
        isActive: true,
      },
    });

    const longTermPricing = await prisma.seatPricing.findFirst({
      where: {
        roomType: type,
        stayType: "LONG_TERM",
        isActive: true,
      },
    });

    if (!shortTermPricing || !longTermPricing) {
      return res.status(400).json({
        success: false,
        message: "Short-term or Long-term seat pricing not found for this room type"
      });
    }

    const { availableSeats, status } = calculateRoomSeats({
  beds,
  bookedSeats: 0,
});

const room = await prisma.room.create({
  data: {
    title,
    type,
    floor,
    beds,
    bookedSeats: 0,
    availableSeats,
    washrooms,
    description,
    shortTermPrice: shortTermPricing.price,
    longTermPrice: longTermPricing.price,
  },
});


    return res.status(201).json({
      success: true,
      message: "Room created successfully",
      data: room
    });
  } catch (error) {
    console.error(error);
    if (error instanceof Error && error.message.includes("validation")) {
      return res.status(400).json({
        success: false,
        message: "Invalid room data provided"
      });
    }
    return res.status(500).json({
      success: false,
      message: "Server is currently unavailable. Please try again later."
    });
  }
};

export const updateRoom = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { id } = req.params;

    const parsedData: updateRoomDTO = updateRoomSchema.parse(req.body);
    const {
      title,
      type,
      floor,
      beds,
      washrooms,
      description,
      status,
    } = parsedData;

    // Get existing room
    const existingRoom = await prisma.room.findUnique({
      where: { id },
      select: { type: true },
    });

    if (!existingRoom) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }


    // Price logic: If room type changed, fetch both pricing types
    let shortTermPriceUpdate: number | undefined = undefined;
    let longTermPriceUpdate: number | undefined = undefined;

    if (type && type !== existingRoom.type) {
      const shortTermPricing = await prisma.seatPricing.findFirst({
        where: {
          roomType: type,
          stayType: "SHORT_TERM",
          isActive: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const longTermPricing = await prisma.seatPricing.findFirst({
        where: {
          roomType: type,
          stayType: "LONG_TERM",
          isActive: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (!shortTermPricing || !longTermPricing) {
        return res.status(400).json({
          success: false,
          message: `No active seat pricing found for room type ${type}`
        });
      }

      shortTermPriceUpdate = shortTermPricing.price;
      longTermPriceUpdate = longTermPricing.price;
    }

    let seatUpdateData = {};

if (beds !== undefined) {
  const bookedSeats = await validateBedsUpdate(id, beds);

  const seatState = calculateRoomSeats({
    beds,
    bookedSeats,
  });

  seatUpdateData = {
    availableSeats: seatState.availableSeats,
    status: seatState.status,
  };
}


    const room = await prisma.room.update({
      where: { id },
      data: {
        title,
        type,
        floor,
        beds,
        washrooms,
        description,
        ...seatUpdateData,
        ...(shortTermPriceUpdate !== undefined && { shortTermPrice: shortTermPriceUpdate }),
        ...(longTermPriceUpdate !== undefined && { longTermPrice: longTermPriceUpdate }),
      },
    });
    

    return res.status(200).json({
      success: true,
      message: "Room updated successfully",
      data: room
    });
  } catch (error: any) {
  console.error(error);

  if (error.message === "BEDS_LESS_THAN_BOOKED") {
    return res.status(400).json({
      success: false,
      message: "Cannot reduce beds below already booked seats",
    });
  }

  if (error instanceof Error && error.message.includes("validation")) {
    return res.status(400).json({
      success: false,
      message: "Invalid room data provided",
    });
  }

  return res.status(500).json({
    success: false,
    message: "Server is currently unavailable. Please try again later.",
  });
}

};


export const getRooms = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      title,
      beds,
      status,
      type,
      minPrice,
      maxPrice,
      page = "1",
      limit = "12",
      sort = "createdAt_desc",
    } = req.query;

    const where: any = {};

    if (title) {
      where.OR = [
        {
          title: {
            contains: title as string,
            mode: "insensitive",
          },
        },
        {
          floor: {
            contains: title as string,
            mode: "insensitive",
          },
        },
      ];
    }

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (beds) {
      where.beds = Number(beds);
    }

    if (minPrice || maxPrice) {
      where.shortTermPrice = {};
      if (minPrice) where.shortTermPrice.gte = Number(minPrice);
      if (maxPrice) where.shortTermPrice.lte = Number(maxPrice);
    }

    const orderBy: any = {};
    if (sort) {
      const [field, direction] = (sort as string).split("_");
      orderBy[field] = direction === "asc" ? "asc" : "desc";
    }

    const skip = (Number(page) - 1) * Number(limit);

    const rooms = await prisma.room.findMany({
      where,
      include: { images: true },
      orderBy,
      skip,
      take: Number(limit),
    });

    const totalRooms = await prisma.room.count({ where });

    return res.status(200).json({
      success: true,
      message: "Rooms fetched successfully",
      data: {
        total: totalRooms,
        page: Number(page),
        limit: Number(limit),
        rooms,
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
export const getSingleRoom = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { id } = req.params;

    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        images: true,
        videos: true,
      },
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    const seatPricings = await prisma.seatPricing.findMany({
      where: {
        roomType: room.type,
        isActive: true,
      },
      select: {
        stayType: true,
        price: true,
      },
    });

    const prices = seatPricings.reduce((acc, item) => {
      acc[item.stayType] = item.price;
      return acc;
    }, {} as Record<string, number>);

    return res.status(200).json({
      success: true,
      message: "Room fetched successfully",
      data: { room, prices }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server is currently unavailable. Please try again later."
    });
  }
};


export const deleteRoom = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { id } = req.params;

    const roomExists = await prisma.room.findUnique({ where: { id } });
    if (!roomExists) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    const images = await prisma.roomImage.findMany({
      where: { roomId: id },
      select: { url: true },
    });

    const videos = await prisma.roomVideo.findMany({
      where: { roomId: id },
      select: { url: true },
    });

    await Promise.all(
      images.map((img) => {
        const key = decodeURIComponent(img.url.split("/").slice(-2).join("/"));
        return deleteFromS3(key);
      })
    );

    await Promise.all(
      videos.map((video) => {
        const key = decodeURIComponent(video.url.split("/").slice(-2).join("/"));
        return deleteFromS3(key);
      })
    );

    await prisma.room.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "Room deleted successfully"
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server is currently unavailable. Please try again later."
    });
  }
};
