import { Router } from "express";
import { createNotification, deleteNotification, getMyNotifications, markAllAsRead, markAsRead } from "./notification.controllers";
import authenticateUserWithRole from "../../middlewares/role.middleware";
import authenticateUser from "../../middlewares/auth.middleware";

const router = Router();

/**
 * Notification Routes
 */

// Create notification - ADMIN only
router.post("/", authenticateUserWithRole(["ADMIN"]), createNotification);

// Get my notifications - authenticated users only
router.get("/", authenticateUser, getMyNotifications);

// Mark as read - authenticated users only
router.patch(
  "/read-all",
  authenticateUser,
  markAllAsRead
);
router.patch("/:id/read", authenticateUser, markAsRead);

// Delete notification - ADMIN only
router.delete("/:id", authenticateUserWithRole(["ADMIN"]), deleteNotification);

export default router;
