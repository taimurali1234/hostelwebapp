import { NotificationAudience, NotificationSeverity } from "@prisma/client";
import { z } from "zod";


/* =========================
   CREATE NOTIFICATION
   ========================= */

export const createNotificationSchema = z.object({
    audience: z.nativeEnum(NotificationAudience),

    userId: z
      .string()
      .uuid("Invalid userId")
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
      .optional()
      .default(NotificationSeverity.INFO),
  })
  .superRefine((data, ctx) => {
    // USER → userId required
    if (data.audience === NotificationAudience.USER && !data.userId) {
      ctx.addIssue({
        path: ["userId"],
        message: "userId is required when audience is USER",
        code: z.ZodIssueCode.custom,
      });
    }

    // ADMIN / ALL_USERS → userId must NOT exist
    if (
      data.audience !== NotificationAudience.USER &&
      data.userId
    ) {
      ctx.addIssue({
        path: ["userId"],
        message: "userId is only allowed when audience is USER",
        code: z.ZodIssueCode.custom,
      });
    }
  });

export type CreateNotificationDTO = z.infer<
  typeof createNotificationSchema
>;
