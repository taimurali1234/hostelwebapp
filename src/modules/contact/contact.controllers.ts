import redis from "../../config/redis";
import { asyncHandler } from "../../utils/asyncHandler";

export const contactUs = asyncHandler(async (req, res) => {
  const { fullName, email, subject, message } = req.body;

  // push job to redis queue
  await redis.lpush("email_queue", JSON.stringify({
    type: "CONTACT",
    data: { fullName, email, subject, message },
    retries: 0
  }));

  res.json({ success: true, message: "Message sent successfully" });
});
