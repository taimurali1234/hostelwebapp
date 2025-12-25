import { Router } from "express";
import {
  createBooking,
  updateBooking,
  deleteBooking,
  getSingleBooking,
  getAllBookings,
  previewBooking,
} from "./booking.controller";
import authenticateUserWithRole from "../../middlewares/role.middleware";

const router = Router();

router.post("/",authenticateUserWithRole(["USER","ADMIN"]), createBooking);
router.post("/preview", previewBooking);
router.get("/", getAllBookings);
router.get("/:id", getSingleBooking);
router.patch("/:id",authenticateUserWithRole(["USER","ADMIN"]), updateBooking);
router.delete("/:id", deleteBooking);

export default router;
