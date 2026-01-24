import { Router } from "express";
import authenticateUserWithRole from "../../middlewares/role.middleware";

const router = Router();

/**
 * Admin Routes - All routes require ADMIN role
 */

// Add admin-specific routes here
// Example: router.get("/dashboard", authenticateUserWithRole(["ADMIN"]), getDashboardData);

export default router;
