import { subscribeToQueue } from "../config/rabitmq";
import { handleNotificationEvent } from "../modules/notifications/notification.service";

export const startNotificationWorker = async () => {

  await subscribeToQueue("USER.EMAIL_VERIFIED", handleNotificationEvent);
  await subscribeToQueue("ORDER.CREATED", handleNotificationEvent);
};
