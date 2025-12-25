import { Router } from "express";
import { getMyNotifications, markAsRead } from "./notification.controllers";

const router = Router();

router.get("/", getMyNotifications);
router.put("/:id/read", markAsRead);

export default router;
