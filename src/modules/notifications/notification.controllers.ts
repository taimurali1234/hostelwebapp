import { NextFunction, Request, Response } from "express";
import prisma from "../../config/prismaClient";
import { NotificationAudience } from "@prisma/client";
import { io } from "../../config/socket.server";
import { CreateNotificationDTO, createNotificationSchema } from "./notificationDTOS/notification.dtos";

/**
 * ✅ USER: Get my notifications
 * (USER + ALL_USERS)
 */
export const getMyNotifications = async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: "You are not authenticated yet" });
  }

  const notifications = await prisma.notification.findMany({
    where: {
      OR: [
        { audience: "ALL_USERS" },
        { audience: "USER", userId },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(notifications);
};

/**
 * ✅ USER: Mark notification as read
 */
export const markAsRead = async (req: Request, res: Response) => {
  const { id } = req.params;

  await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });

  res.json({ message: "Notification marked as read" });
};

/**
 * ✅ ADMIN: Create notification
 */


export const createNotification = async (req: Request, res: Response,next:NextFunction) => {
  try {
    const parsedData = createNotificationSchema.safeParse(req.body)
        console.log(parsedData)

    if (!parsedData.success) {
      // 🔥 Return proper errors
      return res.status(400).json({
        message: "Validation failed",
        errors: parsedData.error.format(), // ← structured errors
      });
    }
    const { audience, userId, title, message, severity } = parsedData.data;

    // 🔒 Basic validation
    if (!audience || !message) {
      return res.status(400).json({
        message: "audience and message are required",
      });
    }

    // 👤 USER → userId required
    if (audience === NotificationAudience.USER && !userId) {
      return res.status(400).json({
        message: "userId is required when audience is USER",
      });
    }

    // 🚫 ADMIN / ALL_USERS → userId not allowed
    if (
      audience !== NotificationAudience.USER &&
      userId
    ) {
      return res.status(400).json({
        message: "userId is only allowed when audience is USER",
      });
    }

    // 🔎 Check user existence (only for USER audience)
    if (audience === NotificationAudience.USER) {
      const userExists = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!userExists) {
        return res.status(404).json({
          message: "User not found",
        });
      }
    }

    // 💾 Create notification
    const notification = await prisma.notification.create({
      data: {
        audience,
        userId: audience === NotificationAudience.USER ? userId : null,
        title,
        message,
        severity,
      },
    });

    // 🔔 SOCKET EMIT (after successful DB write)
    switch (audience) {
      case NotificationAudience.ALL_USERS:
        io.to("users").emit("notification:new", notification);
        break;

      case NotificationAudience.ADMIN:
        io.to("admins").emit("notification:new", notification);
        break;

      case NotificationAudience.USER:
        if (!userId) {
    // Safety net (should never happen)
    break;
  }
        io.to(userId).emit("notification:new", notification);
        break;
    }

    return res.status(201).json(notification);
  } catch (error) {
   next(error)
  }
};


/**
 * ✅ ADMIN: Get all notifications
 */
export const getAllNotifications = async (_req: Request, res: Response) => {
  const notifications = await prisma.notification.findMany({
    select:{user:true},
    orderBy: { createdAt: "desc" },
  });

  res.json(notifications);
};

/**
 * ✅ ADMIN: Update notification
 */
export const updateNotification = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, message, severity } = req.body;

  const notification = await prisma.notification.update({
    where: { id },
    data: { title, message, severity },
  });

  res.json(notification);
};

/**
 * ✅ ADMIN: Delete notification
 */
export const deleteNotification = async (req: Request, res: Response) => {
  const { id } = req.params;

  await prisma.notification.delete({
    where: { id },
  });

  res.json({ message: "Notification deleted successfully" });
};
