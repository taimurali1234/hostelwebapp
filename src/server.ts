import http from "http";
import app from "./app";
import { connectRabit } from "./config/rabitmq";
import { initSocketServer } from "./config/socket.server";
import { startNotificationWorker } from "./utils/notificationWorker";
const server = http.createServer(app);

(async () => {
  try {
    const rabbitConnected = await connectRabit();

    if (rabbitConnected) {
      startNotificationWorker();
      console.log("✅ Notification worker started");
    } else {
      console.warn("⚠️ Notification worker NOT started (RabbitMQ not connected)");
    }

    await initSocketServer(server);
    console.log("✅ Socket server initialized");

    const PORT = process.env.PORT || 3000;

    server.listen(PORT, () => {
      console.log(`🚀 hi Server listening on port ${PORT}`);
    });

  } catch (error) {
    console.error("❌ Server startup failed:", error);
    process.exit(1);
  }
})();
