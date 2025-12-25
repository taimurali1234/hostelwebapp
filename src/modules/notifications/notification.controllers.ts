import { Request, Response } from "express";
import prisma from "../../config/prismaClient";
// import { prisma } from "../../config/prisma";

export const getMyNotifications = async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  res.json(notifications);
};

export const markAsRead = async (req: Request, res: Response) => {
  const { id } = req.params;

  await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });

  res.json({ message: "Notification marked as read" });
};
