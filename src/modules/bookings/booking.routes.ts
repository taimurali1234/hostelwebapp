import { Router } from "express";
import {
  createBooking,
  updateBooking,
  deleteBooking,
  getSingleBooking,
  getAllBookings,
  previewBooking,
  createMultipleBookings,
  getBookingOrderDetails,
  getAllOrders,
  deleteOrder,
  updateOrder,
} from "./booking.controller";
import authenticateUserWithRole from "../../middlewares/role.middleware";
import authenticateUser from "../../middlewares/auth.middleware";

const router = Router();

/**
 * Booking Routes
 */

// Create booking - requires USER or ADMIN role
router.post("/", authenticateUserWithRole(["USER", "ADMIN"]), createBooking);
router.post("/create-multiple", authenticateUserWithRole(["USER", "ADMIN"]), createMultipleBookings);

// Preview booking - public route
router.post("/preview", previewBooking);

// Get all bookings - ADMIN only
router.get("/", authenticateUserWithRole(["ADMIN"]), getAllBookings);

// Get single booking - authenticated users
router.get("/orders", authenticateUser, getAllOrders);
router.get("/:id", authenticateUser, getSingleBooking);
router.get("/order/:orderId", authenticateUser, getBookingOrderDetails);

// Update booking - ADMIN only
router.patch("/:id", authenticateUserWithRole(["ADMIN"]), updateBooking);

// Delete booking - ADMIN only
router.delete("/:id", authenticateUserWithRole(["ADMIN"]), deleteBooking);

/**
 * Order Routes
 */

// Update order - USER or ADMIN
router.patch("/orders/:orderId", authenticateUserWithRole(["USER", "ADMIN"]), updateOrder);

// Delete order - USER or ADMIN
router.delete("/orders/:orderId", authenticateUserWithRole(["USER", "ADMIN"]), deleteOrder);

export default router;
