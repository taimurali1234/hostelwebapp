import { Router } from "express";
import {
  createReview,
  updateReview,
  deleteReview,
  getReviewsForRoom,
  getReview,
  getAllReviews,
} from "./reviews.controllers";
import authenticateUser from "../../middlewares/auth.middleware";
import authenticateUserWithRole from "../../middlewares/role.middleware";

const router = Router();

// All routes require authentication
router.post("/", createReview);
router.get("/", getAllReviews);
router.patch("/:id", updateReview);
router.delete("/:id", deleteReview);

// Public routes
router.get("/room/:roomId", getReviewsForRoom);
router.get("/:id", getReview);

export default router;
