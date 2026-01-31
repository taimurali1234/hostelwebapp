import { deleteFromS3, uploadToS3 } from "../../utils/uploadToS3";
import { Request, Response, NextFunction } from "express";
import prisma from "../../config/prismaClient";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";

export const uploadVideo = asyncHandler(
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const { roomId } = req.body;
    const file = req.file;

    if (!roomId) throw new ApiError(400, "Room ID is required");
    if (!file) throw new ApiError(400, "No video file uploaded");

    const existingCount = await prisma.roomVideo.count({ where: { roomId } });

    if (existingCount >= 1) {
      throw new ApiError(400, "Only 1 video allowed per room");
    }

    const url = await uploadToS3(file);

    const video = await prisma.roomVideo.create({
      data: { url, roomId },
    });

    res.status(201).json({
      success: true,
      message: "Video uploaded successfully",
      data: { video },
    });
  }
);

export const getRoomVideos = asyncHandler(
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const { roomId } = req.params;

    if (!roomId) throw new ApiError(400, "Room ID is required");

    const videos = await prisma.roomVideo.findMany({
      where: { roomId },
      select: { id: true, url: true },
    });

    res.status(200).json({
      success: true,
      message: "Videos fetched successfully",
      data: { images: videos },
    });
  }
);

export const deleteRoomVideo = asyncHandler(
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const { id } = req.params;

    const video = await prisma.roomVideo.findUnique({ where: { id } });

    if (!video) throw new ApiError(404, "Video not found");

    const urlParts = video.url.split("/");
    const keyIndex = urlParts.findIndex((p) => p.includes("rooms"));
    let key = decodeURIComponent(urlParts.slice(keyIndex).join("/"));

    await deleteFromS3(key);

    await prisma.roomVideo.delete({ where: { id } });

    res.status(200).json({
      success: true,
      message: "Video deleted successfully",
    });
  }
);
