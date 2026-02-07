import * as amqplib from "amqplib";

let connection: any | null = null;
let channel: any | null = null;



export async function connectRabbit() {
  if (connection && channel) return channel;

  connection = await amqplib.connect(process.env.RABBIT_URL!);
  channel = await connection.createChannel();
   console.log("✅ RabbitMQ connected");
  
   channel.on("error", (err: any) => {
    console.error("❌ RabbitMQ channel error", err);
    channel = null;
  });
  return channel;
}
