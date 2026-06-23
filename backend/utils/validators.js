function normalizePhoneNumber(phoneNumber) {
  return String(phoneNumber || "").replace(/[^\d+]/g, "").trim();
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(email || "").trim().toLowerCase());
}

function isValidPhoneNumber(phoneNumber) {
  const digits = String(phoneNumber || "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function isValidFullName(fullName) {
  const name = String(fullName || "").trim();
  return name.length >= 3 && /^[a-zA-Z\s]+$/.test(name);
}

function isValidPassword(password) {
  const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{6,}$/;
  return passRegex.test(password);
}

function formatSmsPhoneNumber(phoneNumber) {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);

  if (normalizedPhoneNumber.startsWith("+")) {
    return normalizedPhoneNumber;
  }

  if (/^\d{10}$/.test(normalizedPhoneNumber)) {
    return `+91${normalizedPhoneNumber}`;
  }

  return normalizedPhoneNumber;
}

module.exports = {
  normalizePhoneNumber,
  isValidEmail,
  isValidPhoneNumber,
  isValidFullName,
  isValidPassword,
  formatSmsPhoneNumber,
};
