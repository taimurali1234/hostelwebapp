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

/* ================= UPLOAD IMAGES ================= */

export const uploadImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { roomId } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!roomId) return sendBadRequest(res, "roomId is required");
    if (!files || files.length === 0)
      return sendBadRequest(res, "No files uploaded");

    const existingImagesCount = await prisma.roomImage.count({
      where: { roomId },
    });

    if (existingImagesCount >= 5) {
      return sendBadRequest(
        res,
        `You can upload maximum 5 images per room. Already uploaded: ${existingImagesCount}`
      );
    }

    const uploadedImages = [];

    for (const file of files) {
      const url = await uploadToS3(file);
      console.log(url);

      const image = await prisma.roomImage.create({
        data: { url, roomId },
      });

      uploadedImages.push(image);
    }

    return sendCreated(res, "Images uploaded successfully", {
      images: uploadedImages,
    });
  } catch (error) {
    next(error);
  }
};

/* ================= GET IMAGES ================= */

export const getRoomImages = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { roomId } = req.params;

    if (!roomId) return sendBadRequest(res, "roomId is required");

    const images = await prisma.roomImage.findMany({
      where: { roomId },
      select: { id: true, url: true },
    });

    return sendOK(res, "Images fetched successfully", { images });
  } catch (error) {
    next(error);
  }
};

/* ================= DELETE IMAGE ================= */

export const deleteRoomImage = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { id } = req.params;

    const image = await prisma.roomImage.findUnique({ where: { id } });

    if (!image) return sendNotFound(res, "Image not found");

    const urlParts = image.url.split("/");
    const keyIndex = urlParts.findIndex((p) => p.includes("rooms"));
    let key = decodeURIComponent(urlParts.slice(keyIndex).join("/"));

    await deleteFromS3(key);

    await prisma.roomImage.delete({ where: { id } });

    return sendOK(res, "Image deleted successfully");
  } catch (err) {
    console.error(err);
    return sendInternalServerError(res, "Internal server error");
  }
};
