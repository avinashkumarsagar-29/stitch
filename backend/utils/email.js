const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

async function sendBookingEmail(userEmail, booking) {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || "no-reply@stitch.com";

  const isMailConfigured = host && port && user && pass;

  const subject = `Booking Confirmation - Stitch Custom Booking`;
  const trackingLink = `${process.env.FRONTEND_URL || "http://localhost:3000"}/track?id=${booking.trackingCode || booking.id}`;

  const htmlContent = `
    <div style="font-family: 'Outfit', 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff; color: #1f2937;">
      <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #f3f4f6; padding-bottom: 16px;">
        <h1 style="color: #c322f4; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Stitch</h1>
        <p style="color: #4b5563; margin: 4px 0 0 0; font-size: 14px;">Your Premium Custom Tailoring Partner</p>
      </div>
      
      <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin-top: 0;">Greeting from Stitch!</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #4b5563;">
        Thank you for booking your custom tailoring service with Stitch. We have successfully received and confirmed your order details.
      </p>

      <div style="background: linear-gradient(135deg, #fbf7ff 0%, #f7efff 100%); border: 1px solid #e9d5ff; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
        <p style="margin: 0; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #7c3aed;">Your Order Tracking Code</p>
        <p style="margin: 8px 0 0 0; font-size: 32px; font-weight: 900; color: #c322f4; letter-spacing: 2px;">${booking.trackingCode}</p>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #6b7280;">Use this 7-digit code to track your order progress anytime.</p>
      </div>

      <h3 style="font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; margin-top: 24px; border-bottom: 1px solid #f3f4f6; padding-bottom: 6px;">Order Details</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px;">
        <tr>
          <td style="padding: 6px 0; font-weight: 600; color: #9ca3af; width: 40%;">Cloth Category:</td>
          <td style="padding: 6px 0; color: #1f2937; font-weight: 600;">${booking.clothCategory}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600; color: #9ca3af;">Material:</td>
          <td style="padding: 6px 0; color: #1f2937;">${booking.material}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600; color: #9ca3af;">Approximate Price:</td>
          <td style="padding: 6px 0; color: #c322f4; font-weight: 700;">₹${booking.approxPrice}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600; color: #9ca3af;">Pickup Location:</td>
          <td style="padding: 6px 0; color: #1f2937;">${booking.pickupLocation}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600; color: #9ca3af;">Drop-off Location:</td>
          <td style="padding: 6px 0; color: #1f2937;">${booking.dropoffLocation}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600; color: #9ca3af;">Scheduled Date:</td>
          <td style="padding: 6px 0; color: #1f2937;">${new Date(booking.bookingDate).toLocaleDateString()}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600; color: #9ca3af;">Scheduled Time:</td>
          <td style="padding: 6px 0; color: #1f2937;">${booking.bookingTime instanceof Date
      ? `${String(booking.bookingTime.getUTCHours()).padStart(2, '0')}:${String(booking.bookingTime.getUTCMinutes()).padStart(2, '0')}`
      : String(booking.bookingTime).includes("T")
        ? String(booking.bookingTime).split("T")[1].slice(0, 5)
        : String(booking.bookingTime).slice(0, 5)
    }</td>
        </tr>
      </table>

      <div style="text-align: center; margin-top: 32px;">
        <a href="${trackingLink}" style="display: inline-block; background-color: #c322f4; color: #ffffff; padding: 12px 28px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(195, 34, 244, 0.2); transition: all 0.2s;">Track Order Now</a>
      </div>

      <div style="margin-top: 40px; border-top: 1px solid #f3f4f6; padding-top: 16px; text-align: center; font-size: 11px; color: #9ca3af;">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} Stitch Inc. All rights reserved.</p>
        <p style="margin: 4px 0 0 0;">You are receiving this email because you registered on Stitch.</p>
      </div>
    </div>
  `;

  if (!isMailConfigured) {
    const logFilePath = path.join(__dirname, "../mock_emails.log");
    const logEntry = `
========================================
TIMESTAMP: ${new Date().toISOString()}
TO: ${userEmail}
FROM: ${from}
SUBJECT: ${subject}
BODY:
${htmlContent}
========================================
\n`;
    try {
      fs.appendFileSync(logFilePath, logEntry, "utf8");
      console.log(`Mock email logged successfully to ${logFilePath}`);
    } catch (err) {
      console.error("Failed to write mock email to log file:", err);
    }
    return { sent: false, mock: true };
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

    const info = await transporter.sendMail({
      from,
      to: userEmail,
      subject,
      html: htmlContent,
    });

    console.log("Email sent successfully:", info.messageId);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending email via SMTP:", error);
    throw error;
  }
}

async function sendPriceQuoteEmail(userEmail, booking) {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || "no-reply@stitch.com";

  const isMailConfigured = host && port && user && pass;

  const subject = `New Price Quote for your Stitch Booking - ${booking.trackingCode || booking.id}`;
  const trackingLink = `${process.env.FRONTEND_URL || "http://localhost:3000"}/notifications`;

  const htmlContent = `
    <div style="font-family: 'Outfit', 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff; color: #1f2937;">
      <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #f3f4f6; padding-bottom: 16px;">
        <h1 style="color: #c322f4; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Stitch</h1>
        <p style="color: #4b5563; margin: 4px 0 0 0; font-size: 14px;">Your Premium Custom Tailoring Partner</p>
      </div>
      
      <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin-top: 0;">Hello ${booking.userFullName || 'Valued Customer'},</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #4b5563;">
        Great news! A tailor has reviewed your tailoring request for order <strong>#${booking.trackingCode}</strong> and provided a price quote.
      </p>

      <div style="background: linear-gradient(135deg, #fbf7ff 0%, #f7efff 100%); border: 1px solid #e9d5ff; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
        <p style="margin: 0; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #7c3aed;">Tailor's Price Quote</p>
        <p style="margin: 8px 0 0 0; font-size: 32px; font-weight: 900; color: #c322f4; letter-spacing: 2px;">₹${booking.approxPrice}</p>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #6b7280;">Please review and confirm this quote to proceed with payment.</p>
      </div>

      <h3 style="font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; margin-top: 24px; border-bottom: 1px solid #f3f4f6; padding-bottom: 6px;">Order Details</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px;">
        <tr>
          <td style="padding: 6px 0; font-weight: 600; color: #9ca3af; width: 40%;">Cloth Category:</td>
          <td style="padding: 6px 0; color: #1f2937; font-weight: 600;">${booking.clothCategory || ''}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600; color: #9ca3af;">Material:</td>
          <td style="padding: 6px 0; color: #1f2937;">${booking.material || ''}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600; color: #9ca3af;">Tailor Partner:</td>
          <td style="padding: 6px 0; color: #1f2937;">${booking.tailorName || 'Assigned Tailor'}</td>
        </tr>
      </table>

      <div style="text-align: center; margin-top: 32px;">
        <a href="${trackingLink}" style="display: inline-block; background-color: #c322f4; color: #ffffff; padding: 12px 28px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(195, 34, 244, 0.2); transition: all 0.2s;">Review & Pay Now</a>
      </div>

      <div style="margin-top: 40px; border-top: 1px solid #f3f4f6; padding-top: 16px; text-align: center; font-size: 11px; color: #9ca3af;">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} Stitch Inc. All rights reserved.</p>
        <p style="margin: 4px 0 0 0;">You are receiving this email because you registered on Stitch.</p>
      </div>
    </div>
  `;

  if (!isMailConfigured) {
    const logFilePath = path.join(__dirname, "../mock_emails.log");
    const logEntry = `
========================================
TIMESTAMP: ${new Date().toISOString()}
TO: ${userEmail}
FROM: ${from}
SUBJECT: ${subject}
BODY:
${htmlContent}
========================================
\n`;
    try {
      fs.appendFileSync(logFilePath, logEntry, "utf8");
      console.log(`Mock email logged successfully to ${logFilePath}`);
    } catch (err) {
      console.error("Failed to write mock email to log file:", err);
    }
    return { sent: false, mock: true };
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

    const info = await transporter.sendMail({
      from,
      to: userEmail,
      subject,
      html: htmlContent,
    });

    console.log("Price Quote Email sent successfully:", info.messageId);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending email via SMTP:", error);
    throw error;
  }
}

module.exports = {
  sendBookingEmail,
  sendPriceQuoteEmail,
};
