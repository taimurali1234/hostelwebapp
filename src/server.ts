import http from "http";
import app from "./app";
import { connectRabit } from "./config/rabitmq";
import { initSocketServer } from "./config/socket.server";
import { startNotificationWorker } from "./modules/notifications/notification.service";

const server = http.createServer(app);

(async () => {
  const rabbitConnected =   await connectRabit();


  if (rabbitConnected) {
  startNotificationWorker();
} else {
  console.warn("Notification worker NOT started");
}
  await initSocketServer(server);
  await startNotificationWorker();


const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
	// eslint-disable-next-line no-console
	console.log(`Server listening on port ${PORT}`);
})
})();

