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

export const createRoom = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const parsedData: createRoomDTO = createRoomSchema.parse(req.body);
    const { title, type, floor, beds, washrooms, description} =
      parsedData;
      const seatPricing = await prisma.seatPricing.findFirst({
  where: {
    roomType: type,
    isActive: true,
  },
});
if (!seatPricing) {
  return res.status(400).json({
    message: "Seat pricing not found for this room type",
  });
}
    const room = await prisma.room.create({
      data: {
        title,
        type,
        floor,
        beds,
        washrooms,
        description,
        price:seatPricing.price
      },
    });
    res.status(201).json({ message: "Room is successfully Created", room });
  } catch (error) {
    next(error);
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
     const {title,type,floor,beds,washrooms,description,status} = parsedData;

    const room = await prisma.room.update({
      where: { id },
      data: {
        title,
        type,
        floor,
        beds,
        washrooms,
        description,
        status
      },
    });
    res
      .status(201)
      .json({ message: "Room data is successfully updated ", room });
  } catch (error) {
    next(error);
  }
};

export const getRooms = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      status,
      type,
      minPrice,
      maxPrice,
      page = "1",
      limit = "10",
      sort = "createdAt_desc",
    } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = Number(minPrice);
      if (maxPrice) where.price.lte = Number(maxPrice);
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

    res.status(200).json({
      message: "Rooms fetched successfully",
      total: totalRooms,
      page: Number(page),
      limit: Number(limit),
      rooms,
    });
  } catch (error) {
    next(error);
  }
};
export const getSingleRoom = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { id } = req.params;

    // 1️⃣ Get room with images
    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        images: true,
      },
    });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // 2️⃣ Get seat pricing for this room type
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

    // 3️⃣ Format pricing
    const prices = seatPricings.reduce((acc, item) => {
      acc[item.stayType] = item.price;
      return acc;
    }, {} as Record<string, number>);

    // 4️⃣ Final response
    return res.status(200).json({
      message: "Single Room fetched successfully",
      room,
      prices, // { SHORT_TERM: 2500, LONG_TERM: 45000 }
    });
  } catch (error) {
    next(error);
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
      return res.status(404).json({ message: "Room not found" });
    }
    const images = await prisma.roomImage.findMany({
      where: { roomId: id },
      select: { url: true },
    });
    const videos = await prisma.roomVideo.findMany({
      where:{roomId:id},
      select:{url:true}
    })
    await Promise.all(
      images.map((img) => {
        const key = decodeURIComponent(img.url.split("/").slice(-2).join("/"));
        console.log(key)
         return deleteFromS3(key);
      })
    );
    await Promise.all(
       videos.map((video) => {
        const key = decodeURIComponent(video.url.split("/").slice(-2).join("/"));
        console.log(key)
         return deleteFromS3(key);
      })
    )
    const room = await prisma.room.delete({
      where: { id },
    });

    res.status(200).json({ message: "Room deleted successfully" });
  } catch (error) {
    next(error);
  }
};
