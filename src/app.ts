import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { logger } from "./utils/logger";
import morganLogger from "./middlewares/morganLogger";
import authRoutes from "./modules/users/user.routes"
import roomRoutes from "./modules/rooms/room.routes"
import roomImageRoutes from "./modules/roomImages/roomImages.routes"
import seatPricingRoutes from "./modules/seatPricing/seatPricing.routes";
import taxConfigRoutes from "./modules/bookings/taxConfig/taxconfig.routes";
import bookingRoutes from "./modules/bookings/booking.routes"
import reviewsRoutes from "./modules/reviews/review.routes"
import notificationRoutes from "./modules/notifications/notification.routes"
import dasdboardRoutes from "./modules/Dashboard/dashbaord.routes"
import paymentRoutes from "./modules/payments/payment.routes"
import stripePaymentRouter from "./modules/payments/routes/stripe-payment.routes";
import stripeWebhookRouter from "./modules/payments/routes/stripe-webhook.routes";
import aiAssistantRoutes from "./modules/ai/aiAssistant.routes"
import cartItemsRoutes from "./modules/cart/routes.cart"
import contactRoutes from "./modules/contact/contact.routes"
import { errorHandler } from "./middlewares/error.middleware";

const app = express();

// Stripe webhook needs raw body for signature verification.
app.use("/api/webhooks", stripeWebhookRouter);

app.use(express.json());
app.use(cookieParser());
app.use(
  helmet({
    contentSecurityPolicy: false,
    frameguard: false,
  })
);

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://www.staydude.org",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/**
 * 📊 MORGAN HTTP REQUEST LOGGING
 * Logs all HTTP requests with method, path, status code, and duration
 * Uses Winston in production, console in development
 */
app.use(morganLogger);

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/users",authRoutes)
app.use("/api/rooms",roomRoutes)
app.use("/api/cart",cartItemsRoutes)
app.use("/api/rooms/uploads",roomImageRoutes)
app.use("/api/seat-pricing", seatPricingRoutes);
app.use("/api/tax-config", taxConfigRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dashboard", dasdboardRoutes);
// app.use("/api/webhooks", );
app.use("/api/payments", stripePaymentRouter);
app.use("/api/ai-assistant", aiAssistantRoutes);
app.use("/api/contact", contactRoutes);


app.use(errorHandler);
export default app;

