const mongoose = require("mongoose");

const apiAuditLogSchema = new mongoose.Schema(
    {
        apiKey: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ApiKey",
            default: null
        },
        platformUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "EventPlatformUser",
            default: null
        },
        method: {
            type: String,
            required: true
        },
        path: {
            type: String,
            required: true
        },
        statusCode: {
            type: Number,
            default: null
        },
        ip: {
            type: String,
            default: null
        },
        userAgent: {
            type: String,
            default: null
        },
        responseTimeMs: {
            type: Number,
            default: null
        },
        tier: {
            type: String,
            default: null
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    },
    { timestamps: false }
);

apiAuditLogSchema.index({ apiKey: 1, createdAt: -1 });
apiAuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model("ApiAuditLog", apiAuditLogSchema);
