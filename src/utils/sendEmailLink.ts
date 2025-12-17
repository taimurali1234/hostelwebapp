

import nodemailer, { Transporter } from "nodemailer";
import { SendMailOptions } from "nodemailer";

// OAuth2 Transporter setup
const transporter: Transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    user: process.env.EMAIL_USER,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REFRESH_TOKEN,
    accessToken: process.env.ACCESS_TOKEN,
  },
});

// Verify the connection configuration
transporter.verify((error, success) => {
  if (error) {
    console.error("Error connecting to email server:", error);
  } else {
    console.log("Email server is ready to send messages");
  }
});

// Function to send email
export const sendEmail = async (
  to: string,
  subject: string,
  text?: string,
  html?: string
): Promise<void> => {
  try {
    const mailOptions: SendMailOptions = {
      from: `"NeckRest" <${process.env.EMAIL_USER}>`, // sender address
      to, // receiver
      subject, // Subject line
      text, // plain text body
      html, // html body
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("Message sent: %s", info.messageId);
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

export default sendEmail;
