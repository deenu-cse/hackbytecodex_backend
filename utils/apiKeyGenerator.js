const crypto = require("crypto");
const { API_TIER_LIMITS } = require("../constants/allConstant");

const HMAC_SECRET = process.env.API_KEY_HMAC_SECRET;
const KEY_VERSION = "v1";

const generateApiKey = (userId, epuId, tier) => {
    if (!HMAC_SECRET) {
        throw new Error("API_KEY_HMAC_SECRET is not configured");
    }

    const expiryDays = API_TIER_LIMITS[tier]?.keyExpiryDays || 30;
    const now = Math.floor(Date.now() / 1000);

    const payload = {
        uid: userId.toString(),
        epuId: epuId.toString(),
        tier,
        iat: now,
        exp: now + expiryDays * 24 * 60 * 60,
        jti: crypto.randomBytes(16).toString("hex"),
        v: 1
    };

    const payloadB64 = Buffer.from(JSON.stringify(payload))
        .toString("base64url");

    const dataToSign = `${KEY_VERSION}.${payloadB64}`;

    const hmac = crypto
        .createHmac("sha256", HMAC_SECRET)
        .update(dataToSign)
        .digest("hex");

    return {
        keyString: `${dataToSign}.${hmac}`,
        jti: payload.jti,
        expiresAt: new Date(payload.exp * 1000)
    };
};

const verifyApiKeySignature = (keyString) => {
    try {
        if (!HMAC_SECRET) {
            return { valid: false, payload: null, error: "HMAC secret not configured" };
        }

        const parts = keyString.split(".");
        if (parts.length !== 3) {
            return { valid: false, payload: null, error: "INVALID_FORMAT" };
        }

        const [version, payloadB64, providedHmac] = parts;

        if (version !== KEY_VERSION) {
            return { valid: false, payload: null, error: "UNSUPPORTED_VERSION" };
        }

        const dataToSign = `${version}.${payloadB64}`;
        const expectedHmac = crypto
            .createHmac("sha256", HMAC_SECRET)
            .update(dataToSign)
            .digest("hex");

        const providedBuffer = Buffer.from(providedHmac, "hex");
        const expectedBuffer = Buffer.from(expectedHmac, "hex");

        if (providedBuffer.length !== expectedBuffer.length) {
            return { valid: false, payload: null, error: "INVALID_SIGNATURE" };
        }

        if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
            return { valid: false, payload: null, error: "INVALID_SIGNATURE" };
        }

        const payload = JSON.parse(
            Buffer.from(payloadB64, "base64url").toString("utf8")
        );

        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
            return { valid: false, payload, error: "KEY_EXPIRED" };
        }

        return { valid: true, payload, error: null };
    } catch (err) {
        return { valid: false, payload: null, error: "PARSE_ERROR" };
    }
};

const decodeApiKeyPayload = (keyString) => {
    try {
        const parts = keyString.split(".");
        if (parts.length !== 3) return null;
        return JSON.parse(
            Buffer.from(parts[1], "base64url").toString("utf8")
        );
    } catch {
        return null;
    }
};

const generatePlatformId = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const bytes = crypto.randomBytes(6);
    let id = "EPU-";
    for (let i = 0; i < 6; i++) {
        id += chars[bytes[i] % chars.length];
    }
    return id;
};

const generateTempPassword = () => {
    return crypto.randomBytes(8).toString("hex");
};

module.exports = {
    generateApiKey,
    verifyApiKeySignature,
    decodeApiKeyPayload,
    generatePlatformId,
    generateTempPassword
};
