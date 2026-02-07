import { connectRabbit } from "../../config/rabitmq";
import { sendDLQAlert } from "./rabit.dlqAlert";
import { RETRY_DELAYS, setupQueue } from "./rabit.setupQueue";



export async function subscribeWithRetry(
  queue: string,
  handler: (data: any) => Promise<void>
) {
  const ch = await connectRabbit();
  await setupQueue(queue);

  ch.prefetch(5);

  ch.consume(queue, async (msg:any) => {
    if (!msg) return;

    const data = JSON.parse(msg.content.toString());
    const retryCount = msg.properties.headers["x-retry-count"] || 0;

    try {
      await handler(data);
      ch.ack(msg);

    } catch (err: any) {

      // 🚫 Permanent auth failure → DLQ immediately
      if (err.message === "PERMANENT_AUTH_FAILURE") {
        ch.publish("dlx_exchange", queue, msg.content);
        await sendDLQAlert(queue, { reason: "AUTH_INVALID", data });
        ch.ack(msg);
        return;
      }

      // 🔁 Temporary failure
      if (retryCount < RETRY_DELAYS.length) {
        const retryQueue = `${queue}.retry.${retryCount}`;

        ch.sendToQueue(
          retryQueue,
          msg.content,
          {
            persistent: true,
            headers: {
              "x-retry-count": retryCount + 1
            }
          }
        );
      } else {
        // ⛔ After 24h window
        ch.publish("dlx_exchange", queue, msg.content);
        await sendDLQAlert(queue, { reason: "RETRY_EXHAUSTED_24H", data });
      }

      ch.ack(msg);
    }
  });

  console.log(`👂 Listening with 24h retry window: ${queue}`);
}
