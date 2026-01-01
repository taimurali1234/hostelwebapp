// import { consumeQueue } from "../../config/rabbitmq";
// import { prisma } from "../../config/prisma";
// import { io } from "../../config/socket";

import prisma from "../../config/prismaClient";
import { subscribeToQueue } from "../../config/rabitmq";
import { io } from "../../config/socket.server";
import { NotificationAudience } from "@prisma/client";
import { CreateNotificationDTO, createNotificationSchema } from "./notificationDTOS/notification.dtos";

export const startNotificationWorker = async () => {
  await subscribeToQueue("AUTH_NOTIFICATION.USER_CREATED",async (data) => {
    try {
    const parsedData: CreateNotificationDTO = createNotificationSchema.parse(data);
    console.log(parsedData)
    const { userId, title, audience, message } = parsedData;

    const notification = await prisma.notification.create({
      data: { userId, title, audience, message, isRead: false },
    });
     // 🔥 Real-time emit
    if(audience === NotificationAudience.USER){
if(userId){
    io.to(userId).emit("notification:new", notification);

    }
    }
    if(audience === NotificationAudience.ALL_USERS){
      io.to("users").emit("notification:new",notification)
    }
    if(audience === NotificationAudience.ADMIN){
      io.to("admins").emit("notification:new",notification)
    }

    // socket emit here
  } catch (err) {
    console.log("Notification worker error:", err);
  }


   
    
  });
};
