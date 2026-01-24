import { Router } from "express";
import {
  createTaxConfig,
  getActiveTaxConfig,
  updateTaxConfig,
} from "./taxconfig.controllers";
import authenticateUserWithRole from "../../../middlewares/role.middleware";

const router = Router();

/**
 * Tax Configuration Routes - All administrative routes
 */

// Get active tax config - Public access (needed for payment calculations)
router.get("/active", getActiveTaxConfig);

// Create tax config - ADMIN only
router.post("/", authenticateUserWithRole(["ADMIN"]), createTaxConfig);

// Update tax config - ADMIN only
router.patch("/:id", authenticateUserWithRole(["ADMIN"]), updateTaxConfig);

export default router;
