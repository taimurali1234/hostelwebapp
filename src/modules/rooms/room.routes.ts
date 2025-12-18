import express from "express"
import authenticateUserWithRole from "../../middlewares/role.middleware";
import { createRoom, deleteRoom, getRooms, getSingleRoom, updateRoom } from "./room.controller";
import authenticateUser from "../../middlewares/auth.middleware";
const router = express.Router();


router.post("/create",authenticateUserWithRole(["ADMIN"]),createRoom)
router.patch("/:id",authenticateUserWithRole(["ADMIN"]),updateRoom)
router.get("/",authenticateUser,getRooms)
router.get("/:id",authenticateUser,getSingleRoom)
router.delete("/:id",authenticateUserWithRole(["ADMIN"]),deleteRoom)

export default router
