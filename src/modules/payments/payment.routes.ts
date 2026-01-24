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

// Initiate payment for a booking - Authenticated users (USER or ADMIN)
router.post(
  "/initiate",
  authenticateUserWithRole(["USER", "ADMIN"]),
  initiatePayment
);

// Get payment details for a booking - Authenticated users
router.get(
  "/:bookingId",
  authenticateUserWithRole(["USER", "ADMIN"]),
  getPaymentDetails
);

// Verify payment status - Authenticated users
router.post(
  "/verify",
  authenticateUserWithRole(["USER", "ADMIN"]),
  verifyPayment
);

/**
 * Webhook Routes (for payment provider callbacks)
 * These routes should NOT require authentication as they are called by external providers
 */

// Get payment status by transaction ID - Public (needed for status checks)
router.get("/status/:transactionId", getPaymentStatus);

// Stripe webhook - handles async payment updates (requires Stripe signature verification)
router.post("/webhook/stripe", stripeWebhook);

// EasyPaisa payment callback (requires provider signature verification)
router.post("/easypaisa/callback", easyPaisaCallback);

// JazzCash payment callback (requires provider signature verification)
router.post("/jazzcash/callback", jazzCashCallback);

export default router;
