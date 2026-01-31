import { NotificationAudience, NotificationSeverity } from "@prisma/client";
import { z } from "zod";


/* =========================
   CREATE NOTIFICATION
   ========================= */

export const createNotificationSchema = z.object({
    audience: z.nativeEnum(NotificationAudience, {
      errorMap: () => ({ message: "Invalid audience" }),
    }),

    userId: z
      .string()
      .uuid("Invalid userId").nullable()
      .optional(),

    userRole: z
      .string()
      .optional(),

    title: z
      .string()
      .max(100, "Title too long")
      .optional(),

    message: z
      .string()
      .min(1, "Message is required")
      .max(500, "Message too long"),

    severity: z
      .nativeEnum(NotificationSeverity)
      .default(NotificationSeverity.INFO),
  })
  

export type CreateNotificationDTO = z.infer<
  typeof createNotificationSchema
>;
