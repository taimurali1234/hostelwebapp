import { connectRabbit } from "../../config/rabitmq";
import { setupQueue } from "./rabit.setupQueue";


export async function publishToQueue(
  queue: string,
  payload: any
): Promise<void> {
  const ch = await connectRabbit();
  await setupQueue(queue);

  ch.publish(
    "main_exchange",
    queue,
    Buffer.from(JSON.stringify(payload)),
    {
      persistent: true,
      headers: {
        "x-retry-count": 0
      }
    }
  );

  console.log("📤 Published:", queue);
}
