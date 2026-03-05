const jwt = require("jsonwebtoken");
const { JWT, USER_TYPE } = require("../../constants/allConstant");

const verifyPlatformToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authorization token missing"
            });
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, JWT.EPU_SECRET);

        if (decoded.role !== USER_TYPE.EVENT_PLATFORM_USER) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Invalid platform token."
            });
        }

        req.platformUser = {
            id: decoded.userId,
            email: decoded.email,
            role: decoded.role,
            platformId: decoded.platformId
        };

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired platform token",
            error: error.message
        });
    }
};

module.exports = { verifyPlatformToken };
