const mongoose = require("mongoose");

const apiEventRegistrationSchema = new mongoose.Schema(
    {
        event: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ApiEvent",
            required: true,
            index: true
        },
        platformUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "EventPlatformUser",
            required: true,
            index: true
        },
        registrantName: {
            type: String,
            required: true,
            trim: true
        },
        registrantEmail: {
            type: String,
            required: true,
            lowercase: true,
            trim: true
        },
        registrantPhone: {
            type: String,
            default: null
        },
        formData: {
            type: Map,
            of: mongoose.Schema.Types.Mixed,
            default: {}
        },
        teamName: {
            type: String,
            default: null
        },
        teamMembers: [
            {
                name: { type: String },
                email: { type: String },
                role: { type: String }
            }
        ],
        payment: {
            status: {
                type: String,
                enum: ["FREE", "PENDING", "PAID", "FAILED"],
                default: "FREE"
            },
            amount: { type: Number, default: 0 },
            transactionId: { type: String, default: null }
        },
        attendance: {
            marked: { type: Boolean, default: false },
            markedAt: { type: Date, default: null }
        },
        performance: {
            judgeScores: [
                {
                    judge: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "ApiJudge"
                    },
                    score: Number,
                    feedback: String
                }
            ],
            finalScore: { type: Number, default: null }
        },
        result: {
            position: { type: Number, default: null },
            isWinner: { type: Boolean, default: false },
            prize: { type: String, default: null }
        },
        status: {
            type: String,
            enum: ["REGISTERED", "CANCELLED", "COMPLETED"],
            default: "REGISTERED"
        },
        ipAddress: {
            type: String,
            default: null
        },
        userAgent: {
            type: String,
            default: null
        }
    },
    { timestamps: true }
);

apiEventRegistrationSchema.index(
    { event: 1, registrantEmail: 1 },
    { unique: true }
);
apiEventRegistrationSchema.index({ event: 1, createdAt: -1 });
apiEventRegistrationSchema.index({ event: 1, status: 1 });

module.exports = mongoose.model(
    "ApiEventRegistration",
    apiEventRegistrationSchema
);
