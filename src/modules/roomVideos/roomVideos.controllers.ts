import { deleteFromS3, uploadToS3 } from "../../utils/uploadToS3";
import { Request, Response, NextFunction } from "express";
import prisma from "../../config/prismaClient";
import { sendSuccess, sendCreated, sendBadRequest, sendError, sendNotFound, sendOK, sendInternalServerError } from "../../utils/response";

export const uploadVideo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { roomId } = req.body;
    const file = req.file;
    console.log(roomId, file);
    if (!file)
      return sendBadRequest(res, "No Video file uploaded");
    const existingVideosCount = await prisma.roomVideo.count({
      where: { roomId },
    });

    if (existingVideosCount >= 5) {
      return sendBadRequest(res, `You can upload maximum 1 video per room. Already uploaded: ${existingVideosCount}. Delete existing video to upload again`);
    }

    const url = await uploadToS3(file);

    const video = await prisma.roomVideo.create({
      data: { url, roomId },
    });

    sendCreated(res, "Video successfully uploaded", video);
  } catch (error) {
    next(error);
  }
};

export const deleteRoomVideo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { id } = req.params; // roomImage id

    // 1️⃣ Get image record
    const video = await prisma.roomVideo.findUnique({
      where: { id },
    });

    if (!video) {
      return sendNotFound(res, "Video not found");
    }

    // 2️⃣ Extract S3 Key from URL
    // Example: https://bucket-name.s3.region.amazonaws.com/rooms/123-room.jpg
    const url = video.url;
    const urlParts = url.split("/");
    const keyIndex = urlParts.findIndex((part) => part.includes("rooms"));
    let key = urlParts.slice(keyIndex).join("/"); // rooms/123-room.jpg
    key = decodeURIComponent(key);
    console.log(key);

    // 3️⃣ Delete from S3
    await deleteFromS3(key);

    // 4️⃣ Delete from DB
    const deletedVideo = await prisma.roomVideo.delete({ where: { id } });

    sendOK(res, "Video deleted successfully", deletedVideo);
  } catch (err) {
    console.error(err);
    sendInternalServerError(res, "Internal server error");
  }
};
export const getRoomVideos = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { roomId } = req.params;

    if (!roomId) {
      return sendBadRequest(res, "roomId is required");
    }

    const images = await prisma.roomImage.findMany({
      where: { roomId },
      select: { id: true, url: true }, // only return necessary fields
    });

    return sendOK(res, "Videos fetched successfully", { images });
  } catch (error) {
    next(error);
  }
};
