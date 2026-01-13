import { NextFunction, Request, Response } from "express";
import {
  createRoomDTO,
  createRoomSchema,
  updateRoomDTO,
  updateRoomSchema,
} from "./RoomDTOS/room.dtos";
import prisma from "../../config/prismaClient";
import { deleteFromS3 } from "../../utils/uploadToS3";
import { sendSuccess, sendCreated, sendBadRequest, sendError, sendNotFound, sendOK, sendInternalServerError } from "../../utils/response";
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
      console.log(parsedData)
      const seatPricing = await prisma.seatPricing.findFirst({
  where: {
    roomType: type,
    isActive: true,
  },
});
if (!seatPricing) {
  return sendBadRequest(res, "Seat pricing not found for this room type");
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
    return sendCreated(res, "Room is successfully Created", room);
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
    const {
      title,
      type,
      floor,
      beds,
      washrooms,
      description,
      status,
    } = parsedData;

    /* =========================
       GET EXISTING ROOM
    ========================== */

    const existingRoom = await prisma.room.findUnique({
      where: { id },
      select: { type: true },
    });

    if (!existingRoom) {
      return res.status(404).json({ message: "Room not found" });
    }

    /* =========================
       PRICE LOGIC
    ========================== */

    let priceUpdate: number | undefined = undefined;

    // 🔥 If room type changed → fetch price
    if (type && type !== existingRoom.type) {
      const seatPricing = await prisma.seatPricing.findFirst({
        where: {
          roomType: type,
          isActive: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (!seatPricing) {
        return res.status(400).json({
          message: `No active seat pricing found for room type ${type}`,
        });
      }

      priceUpdate = seatPricing.price;
    }

    /* =========================
       UPDATE ROOM
    ========================== */

    const room = await prisma.room.update({
      where: { id },
      data: {
        title,
        type,
        floor,
        beds,
        washrooms,
        description,
        status,
        ...(priceUpdate !== undefined && { price: priceUpdate }),
      },
    });

    return sendCreated(res, "Room data is successfully updated", room);
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
      title,
      beds,
      status,
      type,
      minPrice,
      maxPrice,
      page = "1",
      limit = "10",
      sort = "createdAt_desc",
    } = req.query;
    const where: any = {};
    // console.log(status,title,beds,type)
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
  where.type = type; // ENUM-safe
}

if (status) {
  where.status = status; // ENUM-safe
}

if (beds) {
  where.beds = Number(beds);
}
    
    // if (type) where.type = type;
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

    return sendOK(res, "Rooms fetched successfully", {
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
      return sendNotFound(res, "Room not found");
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
    return sendOK(res, "Single Room fetched successfully", { room, prices });
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
      return sendNotFound(res, "Room not found");
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

    return sendOK(res, "Room deleted successfully");
  } catch (error) {
    next(error);
  }
};
