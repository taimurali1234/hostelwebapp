import express from "express"
import authenticateUserWithRole from "../../middlewares/role.middleware";
import { createRoom, deleteRoom, getRooms, getSingleRoom, updateRoom } from "./room.controller";
import authenticateUser from "../../middlewares/auth.middleware";
const router = express.Router();


router.post("/",createRoom)
router.patch("/:id",updateRoom)
router.get("/",getRooms)
router.get("/:id",getSingleRoom)
router.delete("/:id",deleteRoom)

export default router
