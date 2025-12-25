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
    
  });
//   console.log(io)

  // 🔐 Socket Auth Middleware
  io.use((socket: AuthenticatedSocket, next) => {
    try {
      const cookies = socket.handshake.headers?.cookie;
      if (!cookies) {
        return next(new Error("No cookies found"));
      }

      const { token } = cookies ? cookie.parse(cookies) : {};

      if (!token) {
        return next(new Error("Token not provided"));
      }
      console.log(token)

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

  // 🔌 Socket Connection
  io.on("connection", (socket: AuthenticatedSocket) => {
    const userId = socket.user!.userId;

    console.log("Socket connected:", userId);
   
    socket.join("5365fb12-1518-4778-b1d7-09e59f52b6df");

    // 🏠 Join personal room

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", userId);
    });
  });
};
