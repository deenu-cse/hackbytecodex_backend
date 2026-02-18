const jwt = require("jsonwebtoken");
const { ROLE_JWT_SECRET_MAP } = require("../../constants/allConstant");

const verifyToken = (allowedRoles = []) => {
  return (req, res, next) => {
    console.log("verifyToken hit");
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          message: "Authorization token missing"
        });
      }

      const token = authHeader.split(" ")[1];

      const decodedWithoutVerify = jwt.decode(token);

      if (!decodedWithoutVerify?.role) {
        return res.status(401).json({
          success: false,
          message: "Invalid token structure"
        });
      }

      const secret = ROLE_JWT_SECRET_MAP[decodedWithoutVerify.role];

      if (!secret) {
        return res.status(403).json({
          success: false,
          message: "Invalid user role"
        });
      }

      const decoded = jwt.verify(token, secret);

      if (
        allowedRoles.length &&
        !allowedRoles.includes(decoded.role)
      ) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }

      req.user = {
        id: decoded.userId,
        role: decoded.role,
        email: decoded.email
      };

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
        error: error.message
      });
    }
  };
};

module.exports = { verifyToken };