const ApiAuditLog = require("../../models/api/ApiAuditLog");

const auditLogger = (req, res, next) => {
    const startTime = Date.now();

    res.on("finish", () => {
        if (!req.apiContext) return;

        const logEntry = {
            apiKey: req.apiContext.apiKey?._id || null,
            platformUser: req.apiContext.platformUser?._id || null,
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            ip:
                req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
                req.connection?.remoteAddress ||
                req.ip,
            userAgent: req.headers["user-agent"] || null,
            responseTimeMs: Date.now() - startTime,
            tier: req.apiContext.tier || null
        };

        ApiAuditLog.create(logEntry).catch(() => {});
    });

    next();
};

module.exports = { auditLogger };
