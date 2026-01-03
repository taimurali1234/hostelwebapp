import { Router } from "express";
import { createNotification, deleteNotification, getMyNotifications, markAsRead } from "./notification.controllers";
import authenticateUserWithRole from "../../middlewares/role.middleware";

const router = Router();

router.post("/",authenticateUserWithRole(["ADMIN"]),createNotification);
router.get("/", getMyNotifications);
router.patch("/:id/read", markAsRead);
router.delete("/:id",authenticateUserWithRole(["ADMIN"]), deleteNotification);

export default router;
