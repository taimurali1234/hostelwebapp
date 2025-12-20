import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "./modules/users/user.routes"
import roomRoutes from "./modules/rooms/room.routes"
import roomImageRoutes from "./modules/roomImages/roomImages.routes"
import { errorHandler } from "./middlewares/error.middleware";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
 origin:"http://localhost:3000",
 credentials:true
}
   

));

app.get("/", (req, res) => res.json({ status: "ok" }));
app.use("/api/users",authRoutes)
app.use("/api/rooms",roomRoutes)
app.use("/api/rooms/uploads",roomImageRoutes)
app.use(errorHandler);
export default app;
