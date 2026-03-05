const mongoose = require("mongoose");
const slugify = require("slugify");

const apiEventSchema = new mongoose.Schema(
    {
        platformUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "EventPlatformUser",
            required: true,
            index: true
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        slug: {
            type: String,
            unique: true,
            index: true
        },
        description: {
            type: String,
            default: ""
        },
        banners: [
            {
                url: String,
                public_id: String
            }
        ],
        eventType: {
            type: String,
            enum: ["HACKATHON", "WORKSHOP", "SEMINAR", "COMPETITION"],
            required: true
        },
        mode: {
            type: String,
            enum: ["ONLINE", "OFFLINE", "HYBRID"],
            default: "ONLINE"
        },
        startDate: {
            type: Date,
            default: null
        },
        endDate: {
            type: Date,
            default: null
        },
        location: {
            name: { type: String, default: null },
            type: { type: String, default: null },
            url: { type: String, default: null }
        },
        registration: {
            isOpen: { type: Boolean, default: true },
            lastDate: { type: Date, default: null },
            limit: { type: Number, default: null },
            fee: { type: Number, default: 0 }
        },
        form: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ApiEventForm",
            default: null
        },
        judges: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "ApiJudge"
            }
        ],
        participantsCount: {
            type: Number,
            default: 0
        },
        status: {
            type: String,
            enum: ["DRAFT", "PUBLISHED", "COMPLETED", "CANCELLED"],
            default: "DRAFT"
        },
        scoring: {
            criteria: [
                {
                    name: { type: String, required: true },
                    weight: { type: Number, required: true }
                }
            ],
            maxScore: { type: Number, default: 100 }
        },
        isPublic: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

apiEventSchema.index({ platformUser: 1, status: 1 });
apiEventSchema.index({ startDate: 1, endDate: 1 });
apiEventSchema.index({ title: "text", description: "text" });

apiEventSchema.pre("save", function (next) {
    if (this.isModified("title") || this.isNew) {
        this.slug =
            slugify(this.title, { lower: true, strict: true }) +
            "-" +
            Date.now().toString(36);
    }
    next();
});

module.exports = mongoose.model("ApiEvent", apiEventSchema);
