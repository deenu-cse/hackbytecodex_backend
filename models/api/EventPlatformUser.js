const mongoose = require("mongoose");

const eventPlatformUserSchema = new mongoose.Schema(
    {
        platformId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        password: {
            type: String,
            required: true,
            select: false
        },
        fullName: {
            type: String,
            required: true,
            trim: true
        },
        avatar: {
            type: String,
            default: null
        },
        subscription: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Subscription",
            default: null
        },
        apiKey: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ApiKey",
            default: null
        },
        status: {
            type: String,
            enum: ["ACTIVE", "SUSPENDED", "EXPIRED"],
            default: "ACTIVE"
        },
        gracePeriodEndsAt: {
            type: Date,
            default: null
        },
        settings: {
            allowedOrigins: { type: [String], default: [] },
            webhookUrl: { type: String, default: null },
            notifyOnRegistration: { type: Boolean, default: true }
        },
        lastLogin: {
            type: Date,
            default: null
        },
        passwordResetToken: {
            type: String,
            select: false,
            default: null
        },
        passwordResetExpires: {
            type: Date,
            select: false,
            default: null
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("EventPlatformUser", eventPlatformUserSchema);
