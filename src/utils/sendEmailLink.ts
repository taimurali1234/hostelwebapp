import { google } from "googleapis";
import nodemailer from "nodemailer";
import redis from "../config/redis"; // Aapka redis instance

const oAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// ⚡ AUTO-REFRESH LOGIC: Jab bhi token update ho, Redis mein save karein
oAuth2Client.on("tokens", async (tokens) => {
  if (tokens.refresh_token) {
    await redis.set("google_refresh_token", tokens.refresh_token);
    console.log("🔄 Redis: New Refresh Token persisted.");
  }
});

const getActiveRefreshToken = async () => {
  // Pehlay Redis check karein, agar wahan nahi to .env wala use karein
  const savedToken = await redis.get("google_refresh_token");
  return savedToken || process.env.REFRESH_TOKEN;
};

const sendEmail = async (to: string, subject: string, html: string): Promise<void> => {
  try {
    const currentRefreshToken = await getActiveRefreshToken();
    
    oAuth2Client.setCredentials({ 
      refresh_token: currentRefreshToken 
    });

    // Google library khud check karegi k token expire hai ya nahi
    const { token } = await oAuth2Client.getAccessToken();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: process.env.EMAIL_USER,
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        refreshToken: currentRefreshToken,
        accessToken: token as string,
      },
    });

    await transporter.sendMail({
      from: `"NeckRest" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log(`📧 Email sent to ${to}`);
  } catch (error: any) {
    console.error("📧 Mail Error:", error.message);
    
    // Agar token revoke ho chuka ho (invalid_grant)
    if (error.message.includes("invalid_grant")) {
        await redis.del("google_refresh_token");
        throw new Error("Email authentication failed. Admin needs to re-login.");
    }
    throw error;
  }
};

export default sendEmail;
