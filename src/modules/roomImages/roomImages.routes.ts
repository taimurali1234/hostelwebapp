import express from "express";
import authenticateUserWithRole from "../../middlewares/role.middleware";
import { 
  deleteRoomImage, 
  uploadImage, 
  getRoomImages 
} from "./roomImages.controllers";
import { uploadImages, uploadVideos } from "../../config/multer";
import { 
  deleteRoomVideo, 
  uploadVideo, 
  getRoomVideos 
} from "../roomVideos/roomVideos.controllers";

const router = express.Router();

/**
 * Room Images and Videos Routes
 */

/* ================= IMAGES ================= */

// Upload images (max 5) - ADMIN or COORDINATOR only
router.post(
  "/",
  authenticateUserWithRole(["ADMIN", "COORDINATOR"]),
  uploadImages.array("images", 5),
  uploadImage
);

// Get images by roomId - ADMIN or COORDINATOR only
router.get("/:roomId", authenticateUserWithRole(["ADMIN", "COORDINATOR"]), getRoomImages);

// Delete image - ADMIN only
router.delete("/:id", authenticateUserWithRole(["ADMIN"]), deleteRoomImage);


/* ================= VIDEOS ================= */

// Upload video (1 only) - ADMIN or COORDINATOR only
router.post(
  "/video",
  authenticateUserWithRole(["ADMIN", "COORDINATOR"]),
  uploadVideos.single("video"),
  uploadVideo
);

// Get videos by roomId - ADMIN or COORDINATOR only
router.get(
  "/video/:roomId",
  authenticateUserWithRole(["ADMIN", "COORDINATOR"]),
  getRoomVideos
);

// Delete video - ADMIN only
router.delete(
  "/video/:id",
  authenticateUserWithRole(["ADMIN"]),
  deleteRoomVideo
);

export default router;
