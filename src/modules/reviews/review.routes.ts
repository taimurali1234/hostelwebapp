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

/**
 * Review Routes
 */

// Public routes - no authentication required
router.get("/", getAllReviews);
router.get("/room/:roomId", getReviewsForRoom);
router.get("/:id", getReview);

// Create review - authenticated users (USER or ADMIN)
router.post("/", authenticateUserWithRole(["USER", "ADMIN"]), createReview);

// Update review - authenticated users (should own the review)
router.patch("/:id", authenticateUserWithRole(["USER", "ADMIN"]), updateReview);

// Delete review - authenticated users or ADMIN
router.delete("/:id", authenticateUserWithRole(["USER", "ADMIN"]), deleteReview);

export default router;
