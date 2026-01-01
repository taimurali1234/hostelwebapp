import { Server, Socket } from "socket.io";
import http from "http";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import { CustomJwtPayload } from "../types/jwt";

interface AuthenticatedSocket extends Socket {
  user?: CustomJwtPayload;
  token?: string;
}

export let io: Server;

export const initSocketServer = (httpServer: http.Server) => {
  io = new Server(httpServer, {
    path: "/socket.io/",
    cors: {
      origin: true,
      credentials: true,
    },
  });

  /* =========================
     🔐 SOCKET AUTH MIDDLEWARE
     ========================= */
  io.use((socket: AuthenticatedSocket, next) => {
    try {
      const cookies = socket.handshake.headers?.cookie;
      if (!cookies) {
        return next(new Error("No cookies found"));
      }

      const { token } = cookie.parse(cookies);

      if (!token) {
        return next(new Error("Token not provided"));
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET!
      ) as CustomJwtPayload;

      socket.user = decoded;
      socket.token = token;

      next();
    } catch (error) {
      next(new Error("Invalid token"));
    }
  });

  /* =========================
     🔌 SOCKET CONNECTION
     ========================= */
  io.on("connection", (socket: AuthenticatedSocket) => {
    const { userId, role } = socket.user!;

    console.log("🔌 Socket connected:", userId);

    /* =========================
       🏠 PERSONAL ROOM
       ========================= */
    socket.join(userId);

    /* =========================
       👥 ALL USERS ROOM
       ========================= */
    socket.join("users");

    /* =========================
       🛡 ADMIN ROOM
       ========================= */
    if (role === "ADMIN") {
      socket.join("admins");
      console.log("🛡 Admin joined admins room:", userId);
    }

    /* =========================
       📦 OPTIONAL: SEND MISSED NOTIFICATIONS
       ========================= */
    socket.on("userConnected", () => {
      console.log("User connected event:", userId);
      // yahan DB se unread notifications emit kar sakte ho
    });

    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected:", userId);
    });
  });
};
