import express from "express"
import authenticateUserWithRole from "../../middlewares/role.middleware";
import { deleteRoomImage, uploadImage } from "./roomImages.controllers";
import { uploadDocs, uploadImages, uploadVideos } from "../../config/multer";
import { deleteRoomVideo, uploadVideo } from "../roomVideos/roomVideos.controllers";
const router  = express.Router();

router.post("/",authenticateUserWithRole(["ADMIN","COORDINATOR"]),uploadImages.array("images",5),uploadImage)
router.post("/video",authenticateUserWithRole(["ADMIN","COORDINATOR"]),uploadVideos.single("video"),uploadVideo)
router.delete("/video/:id",authenticateUserWithRole(["ADMIN"]),deleteRoomVideo)
router.delete("/:id",authenticateUserWithRole(["ADMIN"]),deleteRoomImage)

export default router