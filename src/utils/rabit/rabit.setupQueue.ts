import { connectRabbit } from "../../config/rabitmq";

export const RETRY_DELAYS = [
  5 * 1000,        // 5 sec
  60 * 1000,       // 1 min
  10 * 60 * 1000,  // 10 min
  60 * 60 * 1000,  // 1 hour
  6 * 60 * 60 * 1000, // 6 hours
  24 * 60 * 60 * 1000 // 24 hours (LAST)
];
export async function setupQueue(queue: string) {
  const ch = await connectRabbit();

  
  // Exchanges
  await ch.assertExchange("main_exchange", "direct");
  await ch.assertExchange("retry_exchange", "direct");
  await ch.assertExchange("dlx_exchange", "direct");

  // Main queue
  await ch.assertQueue(queue, {
    durable: true,
    deadLetterExchange: "retry_exchange",
    deadLetterRoutingKey: queue
  });
    await ch.bindQueue(queue, "main_exchange", queue);


 for (let i = 0; i < RETRY_DELAYS.length; i++) {
    const retryQueue = `${queue}.retry.${i}`;

    await ch.assertQueue(retryQueue, {
      durable: true,
      messageTtl: RETRY_DELAYS[i],
      deadLetterExchange: "main_exchange",
      deadLetterRoutingKey: queue
    });

    await ch.bindQueue(retryQueue, "retry_exchange", queue);
  }

  // DLQ
  await ch.assertQueue(`${queue}.dlq`, { durable: true });
  await ch.bindQueue(`${queue}.dlq`, "dlx_exchange", queue);
}

