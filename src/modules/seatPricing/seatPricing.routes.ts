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

// CRUD routes
router.post("/",authenticateUserWithRole(["ADMIN"]), createSeatPricing);            // Create
router.get("/",authenticateUserWithRole(["ADMIN"]), getAllSeatPricing);            // Read all
router.get("/:id",authenticateUserWithRole(["ADMIN"]), getSeatPricingById);        // Read single
router.patch("/:id",authenticateUserWithRole(["ADMIN"]), updateSeatPricing);         // Update
router.delete("/:id",authenticateUserWithRole(["ADMIN"]), deleteSeatPricing);      // Delete

export default router;
