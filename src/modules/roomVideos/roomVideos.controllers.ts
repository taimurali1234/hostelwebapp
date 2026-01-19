import { deleteFromS3, uploadToS3 } from "../../utils/uploadToS3";
import { Request, Response, NextFunction } from "express";
import prisma from "../../config/prismaClient";
import {
  sendCreated,
  sendBadRequest,
  sendNotFound,
  sendOK,
  sendInternalServerError,
} from "../../utils/response";

/* ================= UPLOAD VIDEO ================= */

export const uploadVideo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { roomId } = req.body;
    const file = req.file;

    if (!roomId) return sendBadRequest(res, "Room ID is required");
    if (!file) return sendBadRequest(res, "No video file uploaded");

    const existingCount = await prisma.roomVideo.count({ where: { roomId } });

    if (existingCount >= 1) {
      return sendBadRequest(res, "Only 1 video allowed per room");
    }

    const url = await uploadToS3(file);

    const video = await prisma.roomVideo.create({
      data: { url, roomId },
    });

    return sendCreated(res, "Video uploaded successfully", { video });
  } catch (error) {
    console.error(error);
    if (error instanceof Error && error.message.includes("validation")) {
      return sendBadRequest(res, "Invalid video data provided");
    }
    return sendInternalServerError(res, "Server is currently unavailable. Please try again later.");
  }
};

/* ================= GET VIDEOS ================= */

export const getRoomVideos = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { roomId } = req.params;

    if (!roomId) return sendBadRequest(res, "Room ID is required");

    const videos = await prisma.roomVideo.findMany({
      where: { roomId },
      select: { id: true, url: true },
    });

    return sendOK(res, "Videos fetched successfully", { images: videos });
  } catch (error) {
    console.error(error);
    return sendInternalServerError(res, "Server is currently unavailable. Please try again later.");
  }
};

/* ================= DELETE VIDEO ================= */

export const deleteRoomVideo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { id } = req.params;

    const video = await prisma.roomVideo.findUnique({ where: { id } });

    if (!video) return sendNotFound(res, "Video not found");

    const urlParts = video.url.split("/");
    const keyIndex = urlParts.findIndex((p) => p.includes("rooms"));
    let key = decodeURIComponent(urlParts.slice(keyIndex).join("/"));

    await deleteFromS3(key);

    await prisma.roomVideo.delete({ where: { id } });

    return sendOK(res, "Video deleted successfully");
  } catch (error) {
    console.error(error);
    return sendInternalServerError(res, "Server is currently unavailable. Please try again later.");
  }
};
