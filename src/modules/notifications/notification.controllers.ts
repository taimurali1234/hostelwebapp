import { NextFunction, Request, Response } from "express";
import prisma from "../../config/prismaClient";
import { NotificationAudience } from "@prisma/client";
import { io } from "../../config/socket.server";
import { CreateNotificationDTO, createNotificationSchema } from "./notificationDTOS/notification.dtos";

/**
 * ✅ USER: Get my notifications
 * (USER + ALL_USERS)
 */
export const getMyNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: "You are not authenticated yet" });
    }

    // Get query parameters for filtering and pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const search = (req.query.search as string) || "";
    const audience = (req.query.audience as string) || "";
    const severity = (req.query.severity as string) || "";
    const read = (req.query.read as string) || "";

    // Build where clause
    const where: any = {
      OR: [
        { audience: "ALL_USERS" },
        { audience: "USER", userId },
      ],
    };

    // Add search filter
    if (search) {
      where.OR.push({
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { message: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    // Add audience filter
    if (audience && audience !== "") {
      where.audience = audience;
    }

    // Add severity filter
    if (severity && severity !== "") {
      where.severity = severity;
    }

    // Add read filter
    if (read === "true") {
      where.isRead = true;
    } else if (read === "false") {
      where.isRead = false;
    }

    // Get total count
    const total = await prisma.notification.count({ where });

    // Get paginated notifications
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    return res.json({
      notifications,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("Get my notifications error:", error);
    if (error instanceof Error) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

/**
 * ✅ USER: Mark notification as read
 */
export const markAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return res.json({ message: "Notification marked as read", notification });
  } catch (error) {
    console.error("Mark as read error:", error);
    if (error instanceof Error) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Failed to mark notification as read" });
  }
};

/**
 * ✅ ADMIN: Create notification
 */


export const createNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedData = createNotificationSchema.safeParse(req.body);

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

    return res.status(201).json({ message: "Notification created successfully", notification });
  } catch (error) {
    console.error("Create notification error:", error);
    if (error instanceof Error) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Failed to create notification" });
  }
};


/**
 * ✅ ADMIN: Get all notifications
 */
export const getAllNotifications = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const notifications = await prisma.notification.findMany({
      select: { user: true },
      orderBy: { createdAt: "desc" },
    });

    return res.json(notifications);
  } catch (error) {
    console.error("Get all notifications error:", error);
    if (error instanceof Error) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

/**
 * ✅ ADMIN: Update notification
 */
export const updateNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, message, severity } = req.body;

    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    const notification = await prisma.notification.update({
      where: { id },
      data: { title, message, severity },
    });

    return res.json({ message: "Notification updated successfully", notification });
  } catch (error) {
    console.error("Update notification error:", error);
    if (error instanceof Error) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Failed to update notification" });
  }
};

/**
 * ✅ ADMIN: Delete notification
 */
export const deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await prisma.notification.delete({
      where: { id },
    });

    return res.json({ message: "Notification deleted successfully" });
  } catch (error) {
    console.error("Delete notification error:", error);
    if (error instanceof Error) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Failed to delete notification" });
  }
};
