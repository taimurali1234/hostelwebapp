import { NextFunction, Request, Response } from "express";
import prisma from "../../config/prismaClient";
import { NotificationAudience } from "@prisma/client";
import { io } from "../../config/socket.server";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";

/**
 * ✅ FETCH NOTIFICATIONS WITH PER-USER READ STATE
 * 
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ AUDIENCE RULES:                                                 │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ USER:      Only visible to that specific user                   │
 * │ ALL_USERS: Visible to ALL users (regular users + admin)         │
 * │ ADMIN:     Only visible to ADMIN/COORDINATOR roles              │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * For ADMIN/COORDINATOR: Returns ALL_USERS + ADMIN notifications
 * For REGULAR USER: Returns ALL_USERS + own USER notifications
 */
export const getMyNotifications = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.userId;
    const role = req.user?.role;

    if (!userId) {
      throw new ApiError(401, "You are not authenticated yet");
    }

    // Pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Filters
    const search = (req.query.search as string) || "";
    const audience = req.query.audience as NotificationAudience | undefined;
    const severity = req.query.severity as string | undefined;
    const read = req.query.read as string | undefined;

    /**
     * =========================
     * BUILD WHERE CLAUSE
     * =========================
     */
    let notificationWhere: any;

    if (role === "ADMIN" || role === "COORDINATOR") {
      // ✅ ADMIN/COORDINATOR: Only ALL_USERS and ADMIN notifications (NOT user-specific)
      notificationWhere = {
        OR: [
          { audience: NotificationAudience.ALL_USERS },
          { audience: NotificationAudience.ADMIN },
        ],
      };
    } else {
      // ✅ REGULAR USER: Only ALL_USERS and USER-specific notifications
      notificationWhere = {
        OR: [
          { audience: NotificationAudience.ALL_USERS },
          { audience: NotificationAudience.USER, userId: userId },
        ],
      };
    }

    // Apply audience filter if provided
    if (audience) {
      notificationWhere.AND = notificationWhere.AND || [];
      notificationWhere.AND.push({ audience });
    }

    // Apply search filter
    if (search) {
      notificationWhere.AND = notificationWhere.AND || [];
      notificationWhere.AND.push({
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { message: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    // Apply severity filter
    if (severity) {
      notificationWhere.AND = notificationWhere.AND || [];
      notificationWhere.AND.push({ severity });
    }

    /**
     * =========================
     * FETCH NOTIFICATIONS WITH READ STATE
     * =========================
     */
    const total = await prisma.notification.count({ where: notificationWhere });

    const notifications = await prisma.notification.findMany({
      where: notificationWhere,
      include: {
        // ✅ Get THIS user's read/unread state
        userNotifications: {
          where: { userId },
          select: {
            isRead: true,
            readAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    /**
     * =========================
     * TRANSFORM RESPONSE
     * =========================
     */
    const transformedNotifications = notifications.map((notif) => {
      const userNotif = notif.userNotifications[0]; // Should always be 0 or 1

      return {
        id: notif.id,
        title: notif.title,
        message: notif.message,
        severity: notif.severity,
        audience: notif.audience,
        userId: notif.userId,
        createdAt: notif.createdAt,
        updatedAt: notif.updatedAt,
        // ✅ Per-user read state
        isRead: userNotif?.isRead ?? false,
        readAt: userNotif?.readAt ?? null,
      };
    });

    // ✅ Apply read filter AFTER fetching (since it's in UserNotification)
    let filtered = transformedNotifications;
    if (read === "true") {
      filtered = filtered.filter((n) => n.isRead === true);
    } else if (read === "false") {
      filtered = filtered.filter((n) => n.isRead === false);
    }

    res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      data: {
        notifications: filtered,
        total: filtered.length,
        page,
        limit,
      },
    });
  }
);

/**
 * ✅ MARK SINGLE NOTIFICATION AS READ (PER USER)
 */
export const markAsRead = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw new ApiError(401, "Unauthorized");
    }

    // ✅ Update ONLY this user's read state
    const userNotification = await prisma.userNotification.updateMany({
      where: {
        notificationId: id,
        userId: userId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    if (userNotification.count === 0) {
      throw new ApiError(404, "Notification not found for this user");
    }

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: userNotification,
    });
  }
);

/**
 * ✅ MARK ALL NOTIFICATIONS AS READ (ONLY FOR CURRENT USER)
 */
export const markAllAsRead = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.userId;

    if (!userId) {
      throw new ApiError(401, "Unauthorized");
    }

    // ✅ Mark ONLY current user's unread notifications as read
    // Works for ALL roles: ADMIN, COORDINATOR, USER
    const whereClause = {
      AND: [
        { isRead: false },
        { userId: userId },  // ✅ Key: Filter by current user
      ],
    };

    const updated = await prisma.userNotification.updateMany({
      where: whereClause,
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      message: `${updated.count} notifications marked as read (only for you)`,
      data: { count: updated.count },
    });
  }
);

/**
 * ✅ ADMIN/COORDINATOR: Create notification
 */
export const createNotification = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { audience, userId, title, message, severity } = req.body;
console.log("Creating notification with data:", req.body);
    // 👤 USER → userId required
    if (audience === NotificationAudience.USER && !userId) {
      throw new ApiError(400, "userId is required when audience is USER");
    }

    // 🚫 ADMIN / ALL_USERS → userId not allowed
    if (
      audience !== NotificationAudience.USER &&
      userId
    ) {
      throw new ApiError(400, "userId is only allowed when audience is USER");
    }

    // 🔎 Check user existence (only for USER audience)
    if (audience === NotificationAudience.USER) {
      if (!userId) {
        throw new ApiError(400, "User ID is required");
      }
      const userExists = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!userExists) {
        throw new ApiError(404, "User not found");
      }
    }

    /**
     * =========================
     * CREATE NOTIFICATION
     * =========================
     */
    const notification = await prisma.notification.create({
      data: {
        audience,
        userId: audience === NotificationAudience.USER ? userId : null,
        title,
        message,
        severity,
      },
    });


    /**
     * =========================
     * CREATE USER-NOTIFICATION RECORD(S)
     * =========================
     */
    if (audience === NotificationAudience.USER && userId) {
      // ✅ USER notification: Create for specific user
      await prisma.userNotification.create({
        data: {
          userId,
          notificationId: notification.id,
          isRead: false,
        },
      });
    } else if (audience === NotificationAudience.ALL_USERS) {
      // ✅ ALL_USERS notification: Create for ALL registered users
      const allUsers = await prisma.user.findMany({
        select: { id: true },
      });

      await prisma.userNotification.createMany({
        data: allUsers.map((user) => ({
          userId: user.id,
          notificationId: notification.id,
          isRead: false,
        })),
      });
    } else if (audience === NotificationAudience.ADMIN) {
      // ✅ ADMIN notification: Create for all ADMIN/COORDINATOR users
      const admins = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "COORDINATOR"] } },
        select: { id: true },
      });

      await prisma.userNotification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          notificationId: notification.id,
          isRead: false,
        })),
      });
    }

    /**
     * =========================
     * SOCKET EMIT (REAL-TIME)
     * =========================
     */
    switch (audience) {
      case NotificationAudience.ALL_USERS:
        // ✅ ALL_USERS: Broadcast to ALL connected clients
        // Using io.emit() prevents duplicate delivery to admins in multiple rooms
        console.log(`🔔 Broadcasting to all connected clients`);
        io.emit("notification:new", notification);
        break;

      case NotificationAudience.ADMIN:
        // ✅ ADMIN: Emit only to admins room
        console.log(`🔔 Emitting to admins room`);
        io.to("admins").emit("notification:new", notification);
        break;

      case NotificationAudience.USER:
        // ✅ USER: Emit only to that specific user
        console.log(`🔔 Emitting to user: ${userId}`);
        if (userId) {
          io.to(userId).emit("notification:new", notification);
        }
        break;
    }

    res.status(201).json({
      success: true,
      message: "Notification created successfully",
      data: notification,
    });
  }
);

/**
 * ✅ ADMIN: Get all notifications (global view)
 */
export const getAllNotifications = asyncHandler(
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    const notifications = await prisma.notification.findMany({
      include: {
        user: true,
        userNotifications: {
          select: {
            userId: true,
            isRead: true,
            readAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      data: notifications,
    });
  }
);

/**
 * ✅ ADMIN: Update notification
 */
export const updateNotification = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const { title, message, severity } = req.body;

    if (!message) {
      throw new ApiError(400, "Message is required");
    }

    const notification = await prisma.notification.update({
      where: { id },
      data: { title, message, severity },
    });

    res.status(200).json({
      success: true,
      message: "Notification updated successfully",
      data: notification,
    });
  }
);

/**
 * ✅ ADMIN: Delete notification
 */
export const deleteNotification = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;

    // ✅ CASCADE: Deletes all UserNotification records automatically
    await prisma.notification.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
      data: null,
    });
  }
);
