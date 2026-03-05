const { API_TIER_LIMITS } = require("../../constants/allConstant");

const windowStore = new Map();

const CLEANUP_INTERVAL = 60 * 1000;
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of windowStore.entries()) {
        if (now - data.windowStart > 120 * 1000) {
            windowStore.delete(key);
        }
    }
}, CLEANUP_INTERVAL);

const rateLimiter = (req, res, next) => {
    try {
        const apiContext = req.apiContext;
        if (!apiContext || !apiContext.apiKey) {
            return next();
        }

        const jti = apiContext.apiKey.jti;
        const tier = apiContext.tier;
        const limit = API_TIER_LIMITS[tier]?.rateLimit || 30;
        const windowMs = 60 * 1000;
        const now = Date.now();

        let record = windowStore.get(jti);

        if (!record || now - record.windowStart >= windowMs) {
            record = { count: 0, windowStart: now };
            windowStore.set(jti, record);
        }

        record.count++;

        const remaining = Math.max(0, limit - record.count);
        const resetAt = record.windowStart + windowMs;

        res.set({
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000))
        });

        if (record.count > limit) {
            const retryAfter = Math.ceil((resetAt - now) / 1000);
            res.set("Retry-After", String(retryAfter));
            return res.status(429).json({
                success: false,
                error: "RATE_LIMIT_EXCEEDED",
                message: `Rate limit of ${limit} requests/minute exceeded. Retry after ${retryAfter}s.`,
                retryAfter
            });
        }

        next();
    } catch (err) {
        next();
    }
};

module.exports = { rateLimiter };
