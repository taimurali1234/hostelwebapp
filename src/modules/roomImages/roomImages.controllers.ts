import { deleteFromS3, uploadToS3 } from "../../utils/uploadToS3";
import { Request, Response, NextFunction } from "express";
import prisma from "../../config/prismaClient";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { logger } from "../../utils/logger";

export const uploadImage = asyncHandler(
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const { roomId } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!roomId) throw new ApiError(400, "roomId is required");
    if (!files || files.length === 0)
      throw new ApiError(400, "No files uploaded");

    const existingImagesCount = await prisma.roomImage.count({
      where: { roomId },
    });

    if (existingImagesCount >= 5) {
      throw new ApiError(
        400,
        `You can upload maximum 5 images per room. Already uploaded: ${existingImagesCount}`
      );
    }

    const uploadedImages = [];

    for (const file of files) {
      const url = await uploadToS3(file);

      const image = await prisma.roomImage.create({
        data: { url, roomId },
      });

      uploadedImages.push(image);
    }

    res.status(201).json({
      success: true,
      message: "Images uploaded successfully",
      data: {
        images: uploadedImages,
      },
    });
  }
);

export const getRoomImages = asyncHandler(
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const { roomId } = req.params;

    if (!roomId) throw new ApiError(400, "roomId is required");

    const images = await prisma.roomImage.findMany({
      where: { roomId },
      select: { id: true, url: true },
    });

    res.status(200).json({
      success: true,
      message: "Images fetched successfully",
      data: { images },
    });
  }
);

export const deleteRoomImage = asyncHandler(
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const { id } = req.params;

    const image = await prisma.roomImage.findUnique({ where: { id } });

    if (!image) throw new ApiError(404, "Image not found");

    const urlParts = image.url.split("/");
    const keyIndex = urlParts.findIndex((p) => p.includes("rooms"));
    let key = decodeURIComponent(urlParts.slice(keyIndex).join("/"));

    await deleteFromS3(key);

    await prisma.roomImage.delete({ where: { id } });

    res.status(200).json({
      success: true,
      message: "Image deleted successfully",
    });
  }
);
