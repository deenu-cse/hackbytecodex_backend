const { verifyApiKeySignature } = require("../../utils/apiKeyGenerator");
const ApiKey = require("../../models/api/ApiKey");
const Subscription = require("../../models/api/Subscription");
const EventPlatformUser = require("../../models/api/EventPlatformUser");

const verifyApiKey = async (req, res, next) => {
    try {
        const keyString =
            req.headers["x-api-key"] ||
            (req.headers.authorization?.startsWith("Bearer ")
                ? req.headers.authorization.split(" ")[1]
                : null);

        if (!keyString) {
            return res.status(401).json({
                success: false,
                error: "API_KEY_MISSING",
                message: "API key is required. Provide via x-api-key header or Authorization: Bearer <key>"
            });
        }

        const { valid, payload, error } = verifyApiKeySignature(keyString);

        if (!valid) {
            const statusMap = {
                INVALID_FORMAT: 401,
                UNSUPPORTED_VERSION: 401,
                INVALID_SIGNATURE: 401,
                KEY_EXPIRED: 401,
                PARSE_ERROR: 401
            };
            return res.status(statusMap[error] || 401).json({
                success: false,
                error,
                message: error === "KEY_EXPIRED"
                    ? "API key has expired. Please renew your subscription."
                    : "Invalid API key"
            });
        }

        const apiKeyDoc = await ApiKey.findOne({ jti: payload.jti });

        if (!apiKeyDoc) {
            return res.status(401).json({
                success: false,
                error: "KEY_NOT_FOUND",
                message: "API key not recognized"
            });
        }

        if (apiKeyDoc.status !== "ACTIVE") {
            return res.status(401).json({
                success: false,
                error: "KEY_REVOKED",
                message: `API key is ${apiKeyDoc.status.toLowerCase()}`
            });
        }

        if (apiKeyDoc.ipWhitelist.length > 0) {
            const clientIp =
                req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
                req.connection?.remoteAddress ||
                req.ip;
            if (!apiKeyDoc.ipWhitelist.includes(clientIp)) {
                return res.status(403).json({
                    success: false,
                    error: "IP_NOT_WHITELISTED",
                    message: "Request IP is not whitelisted for this API key"
                });
            }
        }

        const subscription = await Subscription.findOne({
            epuId: apiKeyDoc.epuId,
            status: { $in: ["ACTIVE", "PAST_DUE"] }
        });

        if (!subscription) {
            return res.status(402).json({
                success: false,
                error: "SUBSCRIPTION_INACTIVE",
                message: "No active subscription found. Please renew."
            });
        }

        const platformUser = await EventPlatformUser.findById(apiKeyDoc.epuId);

        if (!platformUser || platformUser.status === "EXPIRED") {
            return res.status(402).json({
                success: false,
                error: "ACCOUNT_INACTIVE",
                message: "Platform account is inactive"
            });
        }

        if (
            platformUser.status === "SUSPENDED" &&
            platformUser.gracePeriodEndsAt &&
            platformUser.gracePeriodEndsAt < new Date()
        ) {
            await EventPlatformUser.findByIdAndUpdate(platformUser._id, {
                status: "EXPIRED"
            });
            return res.status(402).json({
                success: false,
                error: "ACCOUNT_EXPIRED",
                message: "Grace period has ended. Please renew your subscription."
            });
        }

        ApiKey.updateOne(
            { _id: apiKeyDoc._id },
            { $set: { lastUsedAt: new Date() }, $inc: { usageCount: 1 } }
        ).catch(() => {});

        req.apiContext = {
            userId: payload.uid,
            epuId: payload.epuId,
            tier: payload.tier,
            apiKey: apiKeyDoc,
            subscription,
            platformUser
        };

        next();
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: "INTERNAL_ERROR",
            message: "API key verification failed"
        });
    }
};

module.exports = { verifyApiKey };
