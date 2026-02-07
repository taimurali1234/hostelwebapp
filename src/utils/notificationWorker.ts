import { handleNotificationEvent } from "../modules/notifications/notification.service";
import { subscribeWithRetry } from "./rabit/rabbit.consumer";

export const startNotificationWorker = async () => {

  await subscribeWithRetry("USER.EMAIL_VERIFIED", handleNotificationEvent);
  await subscribeWithRetry("ORDER.CREATED", handleNotificationEvent);
};
