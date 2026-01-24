import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
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
import aiRoutes from "./modules/ai/ai.routes"
import { errorHandler } from "./middlewares/error.middleware";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://hostelwebapp-frontend.vercel.app",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

   



app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/users",authRoutes)
app.use("/api/rooms",roomRoutes)
app.use("/api/rooms/uploads",roomImageRoutes)
app.use("/api/seat-pricing", seatPricingRoutes);
app.use("/api/tax-config", taxConfigRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dashboard", dasdboardRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/ai", aiRoutes);


app.use(errorHandler);
export default app;

