const mongoose = require("mongoose");

const apiKeySchema = new mongoose.Schema(
    {
        jti: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        epuId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "EventPlatformUser",
            required: true
        },
        tier: {
            type: String,
            enum: ["BASIC", "PRO", "ENTERPRISE"],
            required: true
        },
        status: {
            type: String,
            enum: ["ACTIVE", "REVOKED", "EXPIRED", "ROTATING"],
            default: "ACTIVE"
        },
        expiresAt: {
            type: Date,
            required: true
        },
        lastUsedAt: {
            type: Date,
            default: null
        },
        usageCount: {
            type: Number,
            default: 0
        },
        ipWhitelist: {
            type: [String],
            default: []
        },
        rotatedFrom: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ApiKey",
            default: null
        },
        rotatedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ApiKey",
            default: null
        }
    },
    { timestamps: true }
);

apiKeySchema.index({ userId: 1, status: 1 });
apiKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("ApiKey", apiKeySchema);
