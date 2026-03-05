const mongoose = require("mongoose");

const apiJudgeSchema = new mongoose.Schema(
    {
        platformUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "EventPlatformUser",
            required: true,
            index: true
        },
        event: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ApiEvent",
            required: true,
            index: true
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        password: {
            type: String,
            required: true,
            select: false
        },
        avatar: {
            type: String,
            default: null
        },
        role: {
            type: String,
            enum: ["JUDGE", "HEAD_JUDGE"],
            default: "JUDGE"
        },
        status: {
            type: String,
            enum: ["INVITED", "ACTIVE", "DEACTIVATED"],
            default: "INVITED"
        },
        inviteToken: {
            type: String,
            select: false,
            default: null
        },
        inviteTokenExpires: {
            type: Date,
            default: null
        },
        lastLogin: {
            type: Date,
            default: null
        },
        assignedRegistrations: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "ApiEventRegistration"
            }
        ]
    },
    { timestamps: true }
);

apiJudgeSchema.index({ event: 1, email: 1 }, { unique: true });
apiJudgeSchema.index({ platformUser: 1, event: 1 });

module.exports = mongoose.model("ApiJudge", apiJudgeSchema);
