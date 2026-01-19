import nodemailer, { Transporter } from "nodemailer";
import { google } from "googleapis";

let transporter: Transporter | null = null;

const oAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

oAuth2Client.setCredentials({
  refresh_token: process.env.REFRESH_TOKEN,
});

// Create & verify transporter
async function createTransporter(): Promise<Transporter> {
  const accessToken = await oAuth2Client.getAccessToken();

  const newTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: process.env.EMAIL_USER,
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      refreshToken: process.env.REFRESH_TOKEN,
      accessToken: accessToken.token!,
    },
  });

  // 🔍 Verify email service
  await newTransporter.verify();
  console.log("✅ Email service verified successfully");

  return newTransporter;
}

// Get cached transporter
async function getTransporter(): Promise<Transporter> {
  if (!transporter) {
    transporter = await createTransporter();
  }
  return transporter;
}

// Send email
const sendEmail = async (
  to: string,
  subject: string,
  text?: string,
  html?: string
): Promise<void> => {
  const mailTransporter = await getTransporter();

  const mailOptions = {
    from: `"NeckRest" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  };

  await mailTransporter.sendMail(mailOptions);
};

export default sendEmail;
