import { Router } from "express";
import {
  createBooking,
  updateBooking,
  deleteBooking,
  getSingleBooking,
  getAllBookings,
} from "./booking.controller";

const router = Router();

router.post("/", createBooking);
router.get("/", getAllBookings);
router.get("/:id", getSingleBooking);
router.put("/:id", updateBooking);
router.delete("/:id", deleteBooking);

export default router;
