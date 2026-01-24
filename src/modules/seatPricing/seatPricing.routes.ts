import express from "express";
import {
  createSeatPricing,
  getAllSeatPricing,
  getSeatPricingById,
  updateSeatPricing,
  deleteSeatPricing,
} from "../seatPricing/seatPricing.controllers";
import authenticateUserWithRole from "../../middlewares/role.middleware";

const router = express.Router();

/**
 * Seat Pricing Routes - All routes require ADMIN role
 */

// Create seat pricing - ADMIN only
router.post("/", authenticateUserWithRole(["ADMIN"]), createSeatPricing);

// Get all seat pricing - ADMIN only
router.get("/", authenticateUserWithRole(["ADMIN"]), getAllSeatPricing);

// Get single seat pricing - ADMIN only
router.get("/:id", authenticateUserWithRole(["ADMIN"]), getSeatPricingById);

// Update seat pricing - ADMIN only
router.patch("/:id", authenticateUserWithRole(["ADMIN"]), updateSeatPricing);

// Delete seat pricing - ADMIN only
router.delete("/:id", authenticateUserWithRole(["ADMIN"]), deleteSeatPricing);

export default router;
