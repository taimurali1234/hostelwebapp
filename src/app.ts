import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "./modules/users/user.routes"

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

export default app;
