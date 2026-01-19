import http from "http";
import app from "./app";
import { connectRabit } from "./config/rabitmq";
import { initSocketServer } from "./config/socket.server";
import { startNotificationWorker } from "./modules/notifications/notification.service";
import sendEmail from "./utils/sendEmailLink";

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

try {
  await sendEmail(
    process.env.EMAIL_USER!,
    "Server Started",
    "Email system is working!"
  );
  console.log("✅ Email service verified");
} catch (err) {
  console.warn("⚠️ Email service not ready", err);
}


    await initSocketServer(server);
    console.log("✅ Socket server initialized");

    const PORT = process.env.PORT || 3000;

    server.listen(PORT, () => {
      console.log(`🚀 Server listening on port ${PORT}`);
    });

  } catch (error) {
    console.error("❌ Server startup failed:", error);
    process.exit(1);
  }
})();
