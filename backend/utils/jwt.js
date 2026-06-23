const crypto = require("crypto");

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || process.env.AUTH_SECRET;

  if (secret && secret.trim()) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be configured in production");
  }

  return "stitch-development-jwt-secret-change-me";
}

function signJwt(payload, expiresInSeconds = 60 * 60 * 24) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "HS256",
    typ: "JWT",
  };
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));
  const signature = crypto
    .createHmac("sha256", getJwtSecret())
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyJwt(token) {
  const [encodedHeader, encodedPayload, signature] = String(token || "").split(".");

  if (!encodedHeader || !encodedPayload || !signature) {
    throw new Error("Malformed token");
  }

  const expectedSignature = crypto
    .createHmac("sha256", getJwtSecret())
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedSignatureBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    throw new Error("Invalid token signature");
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && payload.exp <= now) {
    throw new Error("Token expired");
  }

  return payload;
}

function createAuthToken(user) {
  return signJwt({
    sub: String(user.id),
    id: user.id,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.role || "user",
  });
}

module.exports = {
  base64UrlEncode,
  getJwtSecret,
  signJwt,
  verifyJwt,
  createAuthToken,
};
