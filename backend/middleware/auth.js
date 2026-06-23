const User = require("../models/User");
const { verifyJwt } = require("../utils/jwt");

async function authenticateApiRequest(request, response, next) {
  const authHeader = request.get("authorization") || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return response.status(401).json({
      message: "Authentication required",
    });
  }

  try {
    request.user = verifyJwt(token);
    const userId = Number(request.user.id);
    if (userId) {
      const user = await User.findById(userId);
      if (user && user.isBanned) {
        return response.status(403).json({
          message: "Forbidden: Your account has been deactivated.",
        });
      }
    }
    return next();
  } catch (error) {
    console.error("JWT validation error:", error);
    return response.status(401).json({
      message: "Invalid or expired authentication token",
    });
  }
}

function requireAuth(request, response, next) {
  return authenticateApiRequest(request, response, next);
}

function requireAdmin(request, response, next) {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;

  if (request.user?.role !== "admin") {
    return response.status(403).json({
      message: "Forbidden: Admin access required",
    });
  }

  if (superAdminEmail && request.user?.email !== superAdminEmail) {
    return response.status(403).json({
      message: "Forbidden: You do not have super admin privileges",
    });
  }

  next();
}

function getAuthenticatedUserId(request) {
  return Number(request.user?.id || request.user?.sub || 0);
}

function isAuthenticatedTailor(request) {
  return request.user?.role === "tailor";
}

function canAccessUser(request, userId) {
  return getAuthenticatedUserId(request) === Number(userId) || request.user?.role === "admin";
}

module.exports = {
  authenticateApiRequest,
  requireAuth,
  requireAdmin,
  getAuthenticatedUserId,
  isAuthenticatedTailor,
  canAccessUser,
};
