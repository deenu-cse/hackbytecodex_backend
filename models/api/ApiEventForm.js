const mongoose = require("mongoose");

const apiEventFormSchema = new mongoose.Schema(
    {
        event: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ApiEvent",
            required: true,
            unique: true
        },
        platformUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "EventPlatformUser",
            required: true,
            index: true
        },
        fields: [
            {
                label: { type: String, required: true },
                name: { type: String, required: true },
                type: {
                    type: String,
                    enum: [
                        "TEXT",
                        "EMAIL",
                        "NUMBER",
                        "SELECT",
                        "FILE",
                        "CHECKBOX",
                        "DATE",
                        "URL",
                        "TEXTAREA"
                    ],
                    required: true
                },
                required: { type: Boolean, default: false },
                options: [String],
                placeholder: { type: String, default: "" },
                validationRegex: { type: String, default: null }
            }
        ],
        allowTeams: {
            type: Boolean,
            default: false
        },
        teamSize: {
            min: { type: Number, default: 1 },
            max: { type: Number, default: 4 }
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("ApiEventForm", apiEventFormSchema);
