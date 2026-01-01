import { reviewStatus } from "@prisma/client";
import { z } from "zod";


export const createReviewSchema = z.object({
  userId:z.string(),        // temporary (testing purpose)
  roomId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
  status:z.nativeEnum(reviewStatus).optional()
});

export const updateReviewSchema = z.object({
  rating: z.number().min(1).max(5).optional(),
  comment: z.string().optional(),
  status:z.nativeEnum(reviewStatus).optional()
});

export type createReviewDTO = z.infer<typeof createReviewSchema>;
export type updateReviewDTO = z.infer<typeof updateReviewSchema>;
