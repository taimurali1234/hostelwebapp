import { Router } from "express";
import { createStripeCheckoutSession } from "../controllers/stripe-payment.controller";
import authenticateUserWithRole from "../../../middlewares/role.middleware";

const stripePaymentRouter = Router();

stripePaymentRouter.post(
  "/stripe/checkout-session",
  authenticateUserWithRole(["USER", "ADMIN"]),
  createStripeCheckoutSession
);

export default stripePaymentRouter;
