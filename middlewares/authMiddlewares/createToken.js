const jwt = require("jsonwebtoken");
const { JWT, ROLE_JWT_SECRET_MAP } = require("../../constants/allConstant");

const createToken = (user) => {
  if (!user || !user._id || !user.role) {
    throw new Error("Invalid user data for token generation");
  }

  const secret = ROLE_JWT_SECRET_MAP[user.role];

  if (!secret) {
    throw new Error(`JWT secret not found for role: ${user.role}`);
  }

  return jwt.sign(
    {
      userId: user._id,
      role: user.role,
      email: user.email
    },
    secret,
    {
      expiresIn: JWT.EXPIRE_IN
    }
  );
};

module.exports = { createToken };