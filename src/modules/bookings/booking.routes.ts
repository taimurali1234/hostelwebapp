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
  getUserOrders,
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
router.post("/create-multiple", authenticateUserWithRole(["USER","COORDINATOR", "ADMIN"]), createMultipleBookings);

// Preview booking - public route
router.post("/preview", previewBooking);

// Get all bookings - ADMIN only
router.get("/", authenticateUserWithRole(["ADMIN"]), getAllBookings);

// Get user's own orders - USER endpoint
router.get("/my-orders", authenticateUser, getUserOrders);

// Get all orders - ADMIN only
router.get("/orders/admin/all", authenticateUserWithRole(["ADMIN"]), getAllOrders);

// Get single booking - authenticated users
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
