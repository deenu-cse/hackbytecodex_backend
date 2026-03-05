const mongoose = require("mongoose");

const apiScoreSchema = new mongoose.Schema(
    {
        event: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ApiEvent",
            required: true,
            index: true
        },
        registration: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ApiEventRegistration",
            required: true
        },
        judge: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ApiJudge",
            required: true
        },
        platformUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "EventPlatformUser",
            required: true,
            index: true
        },
        criteria: {
            type: Map,
            of: Number,
            required: true
        },
        total: {
            type: Number,
            default: 0
        },
        feedback: {
            type: String,
            default: ""
        },
        locked: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

apiScoreSchema.index({ registration: 1, judge: 1 }, { unique: true });
apiScoreSchema.index({ event: 1, locked: 1 });

module.exports = mongoose.model("ApiScore", apiScoreSchema);
