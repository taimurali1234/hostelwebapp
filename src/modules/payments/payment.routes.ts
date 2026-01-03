import { Router } from "express";
import {
  initiatePayment,
  getPaymentDetails,
  verifyPayment,
  stripeWebhook,
  easyPaisaCallback,
  jazzCashCallback,
  getPaymentStatus,
} from "./payment.controller";
import authenticateUserWithRole from "../../middlewares/role.middleware";

const router = Router();

/**
 * Payment Management Routes
 */

// Initiate payment for a booking
router.post(
  "/initiate",
  authenticateUserWithRole(["USER", "ADMIN"]),
  initiatePayment
);

// Get payment details for a booking
router.get(
  "/:bookingId",
  authenticateUserWithRole(["USER", "ADMIN"]),
  getPaymentDetails
);

// Verify payment status
router.post(
  "/verify",
  authenticateUserWithRole(["USER", "ADMIN"]),
  verifyPayment
);

// Get payment status by transaction ID (public for webhook callbacks)
router.get("/status/:transactionId", getPaymentStatus);

/**
 * Webhook Routes (for payment provider callbacks)
 */

// Stripe webhook - handles async payment updates
router.post("/webhook/stripe", stripeWebhook);

// EasyPaisa payment callback
router.post("/easypaisa/callback", easyPaisaCallback);

// JazzCash payment callback
router.post("/jazzcash/callback", jazzCashCallback);

export default router;
