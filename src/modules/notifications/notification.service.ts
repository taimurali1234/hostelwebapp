// import { consumeQueue } from "../../config/rabbitmq";
// import { prisma } from "../../config/prisma";
// import { io } from "../../config/socket";

import prisma from "../../config/prismaClient";
import { subscribeToQueue } from "../../config/rabitmq";
import { io } from "../../config/socket.server";

export const startNotificationWorker = async () => {
  await subscribeToQueue("AUTH_NOTIFICATION.USER_CREATED",async (data) => {
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        message: data.message,
        type: data.type,
        isRead: false,
      },
    });

    // 🔥 Real-time emit
    io.to("5365fb12-1518-4778-b1d7-09e59f52b6df").emit("notification", notification);
  });
};
