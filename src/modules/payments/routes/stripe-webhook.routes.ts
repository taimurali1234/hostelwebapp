import { Router, raw } from "express";
import { handleStripeWebhook } from "../controllers/stripe-webhook.controller";

const stripeWebhookRouter = Router();

stripeWebhookRouter.post("/stripe", raw({ type: "application/json" }), handleStripeWebhook);

export default stripeWebhookRouter;
