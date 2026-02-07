import http from "http";
import app from "./app";
import { initSocketServer } from "./config/socket.server";
import { startNotificationWorker } from "./utils/notificationWorker";
import { logger } from "./utils/logger";
import { connectRabbit } from "./config/rabitmq";

const server = http.createServer(app);

(async () => {
  try {
    const rabbitConnected = await connectRabbit();

    if (rabbitConnected) {
      startNotificationWorker();
      logger.success("Notification worker started");
    } else {
      logger.warn("Notification worker NOT started (RabbitMQ not connected)");
    }

    await initSocketServer(server);
    logger.success("Socket server initialized");

    const PORT = process.env.PORT || 3000;

    server.listen(PORT, () => {
      logger.success(`Server listening on port ${PORT}`);
    });

  } catch (error) {
    logger.error("Server startup failed", error);
    process.exit(1);
  }
})();
