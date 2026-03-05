const jwt = require("jsonwebtoken");
const { JWT, USER_TYPE } = require("../../constants/allConstant");

const verifyJudgeToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authorization token missing"
            });
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, JWT.API_JUDGE_SECRET);

        if (decoded.role !== USER_TYPE.API_JUDGE) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Invalid judge token."
            });
        }

        req.judge = {
            id: decoded.judgeId,
            email: decoded.email,
            role: decoded.role,
            eventId: decoded.eventId,
            platformUserId: decoded.platformUserId
        };

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired judge token",
            error: error.message
        });
    }
};

module.exports = { verifyJudgeToken };
