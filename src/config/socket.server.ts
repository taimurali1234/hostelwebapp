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

      // ✅ Read accessToken from cookies (primary for socket connections)
      const { accessToken, refreshToken } = cookie.parse(cookies);
      const token = accessToken || refreshToken;

      if (!token) {
        return next(new Error("Token not provided in cookies"));
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET!
      ) as CustomJwtPayload;

      socket.user = decoded;
      socket.token = token;

      next();
    } catch (error: any) {
      console.error("❌ Socket authentication error:", error.message);
      next(new Error("Invalid or expired token"));
    }
  });

  /* =========================
     🔌 SOCKET CONNECTION
     ========================= */
  io.on("connection", (socket: AuthenticatedSocket) => {
    const { userId, role } = socket.user!;

    console.log(`✅ User connected: ${userId} (${role})`);
    console.log(`📊 Total connected sockets: ${io.engine.clientsCount}`);

    /* =========================
       🏠 PERSONAL ROOM
       ========================= */
    socket.join(userId);
    console.log(`🏠 Joined personal room: ${userId}`);

    /* =========================
       👥 ALL USERS ROOM
       ========================= */
    socket.join("users");
    console.log(`👥 Joined users room`);

    /* =========================
       🛡 ADMIN ROOM
       ========================= */
    if (role === "ADMIN" || role === "COORDINATOR") {
      socket.join("admins");
      console.log(`🛡 Joined admins room`);
    }

    /* =========================
       📦 OPTIONAL: SEND MISSED NOTIFICATIONS
       ========================= */
    socket.on("userConnected", () => {
      // yahan DB se unread notifications emit kar sakte ho
    });

    socket.on("disconnect", () => {
      console.log(`👋 User disconnected: ${userId}`);
    });

    /* =========================
       🚨 ERROR HANDLING
       ========================= */
    socket.on("error", (error) => {
      console.error(`❌ Socket error for user ${userId}:`, error);
    });
  });
};
