import { deleteFromS3, uploadToS3 } from "../../utils/uploadToS3";
import { Request, Response, NextFunction } from "express";
import prisma from "../../config/prismaClient";

export const uploadImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { roomId } = req.body;
    const files = req.files;
    console.log(roomId, files);
    if (!files || files.length === 0)
      return res.status(400).json({ message: "No files uploaded" });
    const existingImagesCount = await prisma.roomImage.count({
      where: { roomId },
    });

    if (existingImagesCount === 5) {
      return res.status(400).json({
        message: `You can upload maximum 5 images per room. Already uploaded: ${existingImagesCount}. Delete some images to upload again`,
      });
    }

    const uploadedImages = [];
    if (Array.isArray(files)) {
      for (const file of files) {
        const url = await uploadToS3(file);

        const image = await prisma.roomImage.create({
          data: { url, roomId },
        });

        uploadedImages.push(image);
      }
    }

    if (uploadedImages) {
      res
        .status(201)
        .json({ message: "Image successfully uploaded", uploadedImages });
    }
  } catch (error) {
    next(error);
  }
};


export const deleteRoomImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { id } = req.params; // roomImage id

    // 1️⃣ Get image record
    const image = await prisma.roomImage.findUnique({
      where: { id },
    });

    if (!image) {
      return res.status(404).json({ message: "Image not found" });
    }

    // 2️⃣ Extract S3 Key from URL
    // Example: https://bucket-name.s3.region.amazonaws.com/rooms/123-room.jpg
    const url = image.url;
    const urlParts = url.split("/");
    const keyIndex = urlParts.findIndex((part) => part.includes("rooms"));
    let key = urlParts.slice(keyIndex).join("/"); // rooms/123-room.jpg
    key = decodeURIComponent(key);
    console.log(key);

    // 3️⃣ Delete from S3
    await deleteFromS3(key);

    // 4️⃣ Delete from DB
    const imagesAfterDelete = await prisma.roomImage.delete({ where: { id } });

    res
      .status(200)
      .json({ message: "Image deleted successfully", imagesAfterDelete });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", err });
  }
};
export const getRoomImages = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { roomId } = req.params;

    if (!roomId) {
      return res.status(400).json({ message: "roomId is required" });
    }

    const images = await prisma.roomImage.findMany({
      where: { roomId },
      select: { id: true, url: true }, // only return necessary fields
    });

    return res.status(200).json({ images });
  } catch (error) {
    next(error);
  }
};
