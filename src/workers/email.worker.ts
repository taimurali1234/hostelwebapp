import "dotenv/config";
import redis from "../config/redis";
import sendEmail from "../utils/sendEmailLink";

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

const startEmailWorker = async () => {
  console.log("📨 Email worker started...");

  while (true) {
    try {
      const job = await redis.rpop("email_queue");

      if (!job) {
        await sleep(1000); // wait 1 sec
        continue;
      }

      const parsed = JSON.parse(job);

      try {
        await sendEmail(
          process.env.EMAIL_USER!,
          parsed.data.subject,
          `
          <h3>New Contact Message</h3>
          <p><b>Name:</b> ${parsed.data.fullName}</p>
          <p><b>Email:</b> ${parsed.data.email}</p>
          <p><b>Message:</b> ${parsed.data.message}</p>
          `
        );

        console.log("✅ Email sent");
      } catch (err) {
        parsed.retries++;

        if (parsed.retries < 5) {
          console.log("🔁 Retrying email...");
          await redis.lpush("email_queue", JSON.stringify(parsed));
        } else {
          console.error("❌ Email permanently failed", parsed);
        }
      }

    } catch (err) {
      console.error("Worker crash error:", err);
      await sleep(2000);
    }
  }
};

startEmailWorker();
