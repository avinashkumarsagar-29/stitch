require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const nodemailer = require("nodemailer");

async function sendTestEmail() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || "no-reply@stitch.com";

  console.log("SMTP Config:");
  console.log(`- Host: ${host}`);
  console.log(`- Port: ${port}`);
  console.log(`- User: ${user}`);
  console.log(`- From: ${from}`);

  if (!host || !port || !user || !pass) {
    console.error("Error: SMTP variables are not fully configured in your .env file!");
    process.exit(1);
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: port === "465",
      auth: {
        user,
        pass,
      },
    });

    console.log("Sending test email to sagarcode29@gmail.com...");
    const info = await transporter.sendMail({
      from,
      to: "sagarcode29@gmail.com",
      subject: "Stitch SMTP Test Email",
      text: "This is a test email sent from the Stitch backend to verify the SMTP configurations.",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #c322f4;">Stitch SMTP Test</h2>
          <p>This is a test email verifying that your SMTP configurations in <strong>.env</strong> are working correctly!</p>
          <p>Time sent: ${new Date().toISOString()}</p>
        </div>
      `,
    });

    console.log("Email sent successfully!");
    console.log("Message ID:", info.messageId);
    process.exit(0);
  } catch (error) {
    console.error("Failed to send email:");
    console.error(error);
    process.exit(1);
  }
}

sendTestEmail();
