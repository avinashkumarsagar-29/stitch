const https = require("https");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const { formatSmsPhoneNumber } = require("./validators");

const otpExpiryMinutes = 5;

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function postForm(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
          ...headers,
        },
      },
      (response) => {
        let responseBody = "";

        response.on("data", (chunk) => {
          responseBody += chunk;
        });

        response.on("end", () => {
          resolve({
            ok: response.statusCode >= 200 && response.statusCode < 300,
            statusCode: response.statusCode,
            body: responseBody,
          });
        });
      },
    );

    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

function isConfiguredSecret(value, placeholder) {
  return Boolean(value && value.trim() && value !== placeholder);
}

async function sendOtpSms(phoneNumber, otpCode) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

  const isSmsConfigured =
    isConfiguredSecret(accountSid, "your_twilio_account_sid") &&
    isConfiguredSecret(authToken, "your_twilio_auth_token") &&
    isConfiguredSecret(fromPhoneNumber, "+15551234567");

  if (!isSmsConfigured) {
    console.log(`SMS not configured. OTP for ${phoneNumber}: ${otpCode}`);
    return { sent: false };
  }

  const smsBody = new URLSearchParams({
    To: formatSmsPhoneNumber(phoneNumber),
    From: fromPhoneNumber,
    Body: `Your Stitch login OTP is ${otpCode}. It expires in ${otpExpiryMinutes} minutes.`,
  }).toString();
  const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const result = await postForm(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    smsBody,
    {
      Authorization: `Basic ${authHeader}`,
    },
  );

  if (!result.ok) {
    throw new Error(`Twilio SMS failed with status ${result.statusCode}: ${result.body}`);
  }

  return { sent: true };
}

// Singleton transporter — create once, reuse always
let _smtpTransporter = null;
function getSmtpTransporter() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !port || !user || !pass) return null;
  if (!_smtpTransporter) {
    _smtpTransporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: port === "465",
      pool: true,
      maxConnections: 3,
      family: 4,           // force IPv4 — Render does not support IPv6 SMTP
      auth: { user, pass },
    });
  }
  return _smtpTransporter;
}

async function sendOtpEmail(userEmail, userName, otpCode) {
  const from = process.env.SMTP_FROM || "no-reply@stitch.com";
  const subject = "Your Stitch Login OTP";
  const htmlContent = `
    <div style="font-family: 'Plus Jakarta Sans', 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff; color: #1f2937;">
      <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #f3f4f6; padding-bottom: 16px;">
        <h1 style="color: #c322f4; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Stitch</h1>
        <p style="color: #4b5563; margin: 4px 0 0 0; font-size: 14px;">Your Premium Custom Tailoring Partner</p>
      </div>
      
      <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin-top: 0;">Hi ${userName},</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #4b5563;">
        Please use the following One-Time Password (OTP) to complete your login. This OTP is valid for 5 minutes. Do not share it with anyone.
      </p>

      <div style="background: linear-gradient(135deg, #fbf7ff 0%, #f7efff 100%); border: 1px solid #e9d5ff; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="margin: 0; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #7c3aed;">Your Secure OTP</p>
        <p style="margin: 12px 0 0 0; font-size: 38px; font-weight: 900; color: #c322f4; letter-spacing: 6px; font-family: monospace;">${otpCode}</p>
      </div>

      <p style="font-size: 12px; line-height: 1.6; color: #9ca3af; margin-top: 24px; border-top: 1px solid #f3f4f6; padding-top: 16px;">
        If you did not request this, please ignore this email.
      </p>

      <div style="margin-top: 24px; text-align: center; font-size: 11px; color: #9ca3af;">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} Stitch Inc. All rights reserved.</p>
        <p style="margin: 4px 0 0 0;">You are receiving this because you requested a login OTP on Stitch.</p>
      </div>
    </div>
  `;

  const transporter = getSmtpTransporter();
  if (!transporter) {
    console.log(`[MOCK OTP] To: ${userEmail} | OTP: ${otpCode}`);
    return { sent: false, mock: true, otp: otpCode };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to: userEmail,
      subject,
      html: htmlContent,
    });
    console.log("OTP Email sent:", info.messageId);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending OTP email:", error);
    throw error;
  }
}

module.exports = {
  generateOtp,
  sendOtpSms,
  sendOtpEmail,
  postForm,
  isConfiguredSecret,
};
