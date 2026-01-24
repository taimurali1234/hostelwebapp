import express from "express"
import authenticateUserWithRole from "../../middlewares/role.middleware";
import { createRoom, deleteRoom, getRooms, getSingleRoom, updateRoom } from "./room.controller";
import authenticateUser from "../../middlewares/auth.middleware";

const router = express.Router();

/**
 * Room Routes
 */

// Create room - ADMIN or COORDINATOR only
router.post("/", authenticateUserWithRole(["ADMIN", "COORDINATOR"]), createRoom);

// Get all rooms - Public access
router.get("/", authenticateUser, getRooms);

// Get single room - Public access
router.get("/:id",authenticateUser, getSingleRoom);

// Update room - ADMIN or COORDINATOR only
router.patch("/:id", authenticateUserWithRole(["ADMIN", "COORDINATOR"]), updateRoom);

// Delete room - ADMIN only
router.delete("/:id", authenticateUserWithRole(["ADMIN"]), deleteRoom);

export default router;
