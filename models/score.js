const mongoose = require("mongoose");

const scoreSchema = new mongoose.Schema({
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
        required: true
    },

    registration: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "EventRegistration",
        required: true
    },

    judge: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Judge",
        required: true
    },

    criteria: {
        innovation: Number,
        technical: Number,
        presentation: Number,
        design: Number
    },

    total: {
        type: Number
    },

    feedback: String,

    locked: {
        type: Boolean,
        default: false
    }

}, { timestamps: true })

scoreSchema.index(
    { registration: 1, judge: 1 },
    { unique: true }
);
scoreSchema.index({ event: 1 });

module.exports = mongoose.model("Score", scoreSchema)