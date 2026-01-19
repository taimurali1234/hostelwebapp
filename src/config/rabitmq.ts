import * as amqplib from "amqplib";


let connection: any | null = null;
let channel: any | null = null;

export async function connectRabit() {

    if (connection) return connection;

    try {
        connection = await amqplib.connect(process.env.RABBIT_URL);
        console.log('Connected to RabbitMQ');
        channel = await connection.createChannel();
        return true;
    }
    catch (error) {
        console.error('Error connecting to RabbitMQ:', error);
    }

}


export const publishToQueue = async (
  queueName: string,
  data: unknown = {}
): Promise<void> => {
  if (!channel) await connectRabit();

  await channel!.assertQueue(queueName, { durable: true });
  channel!.sendToQueue(
    queueName,
    Buffer.from(JSON.stringify(data)),
    { persistent: true }
  );

  console.log("📤 Message sent:", queueName, data);
};

export const subscribeToQueue = async (
  queueName: string,
  callback: (data: any) => Promise<void>
): Promise<void> => {
  if (!channel) await connectRabit();

  await channel!.assertQueue(queueName, { durable: true });

  channel!.consume(queueName, async (msg:any) => {
    if (!msg) return;

    const data = JSON.parse(msg.content.toString());
    await callback(data);
    channel!.ack(msg);
  });
};
