

import prisma from "../../config/prismaClient";
import { io } from "../../config/socket.server";
import { NotificationAudience } from "@prisma/client";
import { CreateNotificationDTO, createNotificationSchema } from "./notificationDTOS/notification.dtos";

/**
 * ✅ EVENT HANDLER FOR RABBITMQ NOTIFICATIONS
 * Creates Notification + UserNotification records for ALL_USERS / ADMIN audiences
 */
export const handleNotificationEvent = async (data: unknown) => {
  try {
    const parsedData: CreateNotificationDTO = createNotificationSchema.parse(data);
    const { userId, userRole, title, audience, severity, message } = parsedData;

    console.log(`📨 Processing notification: ${audience} for ${userId || "all"}`);

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

    console.log(`💾 Notification saved: ${notification.id}`);

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
      console.log(`📌 UserNotification created for user: ${userId}`);
    } else if (audience === NotificationAudience.ALL_USERS) {
      // ✅ ALL_USERS notification: Create for ALL registered users
      const allUsers = await prisma.user.findMany({
        select: { id: true },
      });

      const userNotifications = allUsers.map((user) => ({
        userId: user.id,
        notificationId: notification.id,
        isRead: false,
      }));

      await prisma.userNotification.createMany({
        data: userNotifications,
      });
      console.log(`📌 UserNotifications created for ${allUsers.length} users`);
    } else if (audience === NotificationAudience.ADMIN) {
      // ✅ ADMIN notification: Create for all ADMIN/COORDINATOR users
      const admins = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "COORDINATOR"] } },
        select: { id: true },
      });

      const adminNotifications = admins.map((admin) => ({
        userId: admin.id,
        notificationId: notification.id,
        isRead: false,
      }));

      await prisma.userNotification.createMany({
        data: adminNotifications,
      });
      console.log(`📌 UserNotifications created for ${admins.length} admins`);
    }

    /**
     * =========================
     * SOCKET EMIT (REAL-TIME)
     * =========================
     */
    if (audience === NotificationAudience.USER && userId) {
      console.log(`🔔 Emitting to user: ${userId}`);
      io.to(userId).emit("notification:new", notification);
    } else if (audience === NotificationAudience.ALL_USERS) {
      // ✅ ALL_USERS: Broadcast to ALL connected clients (includes admins in users room)
      // Using io.emit() prevents duplicate delivery to admins in multiple rooms
      console.log(`🔔 Broadcasting to all connected clients`);
      io.emit("notification:new", notification);
    } else if (audience === NotificationAudience.ADMIN) {
      // ✅ ADMIN: Emit only to admins
      console.log(`🔔 Emitting to admins room`);
      io.to("admins").emit("notification:new", notification);
    }
  } catch (error) {
    console.error(`❌ Error in handleNotificationEvent:`, error);
  }
};
