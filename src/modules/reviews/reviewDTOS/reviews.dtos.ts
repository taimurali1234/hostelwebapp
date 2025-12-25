import { z } from "zod";

export const createReviewSchema = z.object({
  roomId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
});

export const updateReviewSchema = z.object({
  rating: z.number().min(1).max(5).optional(),
  comment: z.string().optional(),
});

export type createReviewDTO = z.infer<typeof createReviewSchema>
export type updateReviewDTO = z.infer<typeof updateReviewSchema>