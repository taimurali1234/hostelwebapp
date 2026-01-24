import { Router } from "express";
import authenticateUserWithRole from "../../middlewares/role.middleware";
import { getDashboardData } from "./dashboard.controllers";

const router = Router();

/**
 * Dashboard Routes
 */

// Get dashboard data - ADMIN only
router.get(
  "/",
  authenticateUserWithRole(["ADMIN"]),
  getDashboardData
);

export default router;
