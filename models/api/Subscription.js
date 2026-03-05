const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        epuId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "EventPlatformUser",
            default: null
        },
        plan: {
            type: String,
            enum: ["BASIC", "PRO", "ENTERPRISE"],
            required: true
        },
        status: {
            type: String,
            enum: ["PENDING", "ACTIVE", "CANCELLED", "PAST_DUE", "EXPIRED"],
            default: "PENDING"
        },
        razorpay: {
            orderId: { type: String, default: null },
            paymentId: { type: String, default: null },
            subscriptionId: { type: String, default: null },
            signature: { type: String, default: null }
        },
        amount: {
            type: Number,
            required: true
        },
        currency: {
            type: String,
            default: "INR"
        },
        billingCycle: {
            type: String,
            enum: ["MONTHLY", "YEARLY"],
            required: true
        },
        currentPeriodStart: {
            type: Date,
            default: null
        },
        currentPeriodEnd: {
            type: Date,
            default: null
        },
        cancelledAt: {
            type: Date,
            default: null
        },
        usage: {
            eventsCreated: { type: Number, default: 0 },
            lastResetAt: { type: Date, default: Date.now }
        },
        invoices: [
            {
                invoiceId: String,
                amount: Number,
                paidAt: Date,
                receiptUrl: String
            }
        ]
    },
    { timestamps: true }
);

subscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });

module.exports = mongoose.model("Subscription", subscriptionSchema);
