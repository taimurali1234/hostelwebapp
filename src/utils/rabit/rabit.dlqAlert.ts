import sendEmail from "../sendEmailLink";

export async function sendDLQAlert(
  queue: string,
  payload: any
): Promise<void> {
  const subject = `🚨 RabbitMQ DLQ Alert – ${queue}`;

  const html = `
    <h2>Permanent Message Failure</h2>
    <p><strong>Queue:</strong> ${queue}</p>
    <p><strong>Time:</strong> ${new Date().toISOString()}</p>

    <pre style="background:#f4f4f4;padding:10px;">
${JSON.stringify(payload, null, 2)}
    </pre>

    <p>Please investigate this issue.</p>
  `;

  try {
    await sendEmail(
      process.env.ADMIN_EMAILS!,
      subject,
      html
    );

    console.log("📧 DLQ alert email sent");
  } catch (err) {
    // ❗ VERY IMPORTANT
    // Email failure should NOT crash worker
    console.error("❌ DLQ alert email failed", err);
  }
}
