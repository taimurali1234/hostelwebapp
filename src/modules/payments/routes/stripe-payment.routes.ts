import { Router } from "express";
import {
  createStripeCheckoutSession,
  getAllPayments,
  deletePayment,
} from "../controllers/stripe-payment.controller";
import authenticateUserWithRole from "../../../middlewares/role.middleware";

const stripePaymentRouter = Router();

stripePaymentRouter.get("/", authenticateUserWithRole(["ADMIN"]), getAllPayments);
stripePaymentRouter.delete("/:paymentId", authenticateUserWithRole(["ADMIN"]), deletePayment);

stripePaymentRouter.post(
  "/stripe/checkout-session",
  authenticateUserWithRole(["USER", "ADMIN"]),
  createStripeCheckoutSession
);

export default stripePaymentRouter;
