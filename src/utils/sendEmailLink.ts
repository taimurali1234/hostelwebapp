import nodemailer, { Transporter } from "nodemailer";
import { SendMailOptions } from "nodemailer";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
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
  }
  return transporter;
}

const sendEmail = async (
  to: string,
  subject: string,
  text?: string,
  html?: string
): Promise<void> => {
  const transporter = getTransporter();

  const mailOptions: SendMailOptions = {
    from: `"NeckRest" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  };

  await transporter.sendMail(mailOptions);
};

export default sendEmail