const mongoose = require("mongoose");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { razorpay, verifyRazorpaySignature, verifyWebhookSignature } = require("../../utils/razorpayClient");
const { generateApiKey, generatePlatformId, generateTempPassword } = require("../../utils/apiKeyGenerator");
const { API_PLAN_PRICING, API_TIER, API_TIER_LIMITS } = require("../../constants/allConstant");
const Subscription = require("../../models/api/Subscription");
const ApiKey = require("../../models/api/ApiKey");
const EventPlatformUser = require("../../models/api/EventPlatformUser");
const User = require("../../models/user");
const sendEmail = require("../../utils/sendEmail");

const createOrder = async (req, res) => {
    try {
        console.log("Creating order for user:", req.user)
        const { plan, billingCycle } = req.body;
        const userId = req.user.id;

        if (!plan || !API_TIER[plan]) {
            return res.status(400).json({
                success: false,
                message: "Invalid plan. Choose from: BASIC, PRO, ENTERPRISE"
            });
        }

        if (!billingCycle || !["MONTHLY", "YEARLY"].includes(billingCycle)) {
            return res.status(400).json({
                success: false,
                message: "Invalid billing cycle. Choose: MONTHLY or YEARLY"
            });
        }

        const existingSub = await Subscription.findOne({
            userId,
            status: { $in: ["ACTIVE", "PENDING"] }
        });

        if (existingSub && existingSub.status === "ACTIVE") {
            return res.status(409).json({
                success: false,
                message: "You already have an active subscription. Cancel it first or upgrade."
            });
        }

        const pricing = API_PLAN_PRICING[plan];
        const amount = billingCycle === "MONTHLY" ? pricing.monthly : pricing.yearly;

        const order = await razorpay.orders.create({
            amount,
            currency: "INR",
            receipt: `epu_${userId}_${Date.now()}`,
            notes: {
                userId,
                plan,
                billingCycle
            }
        });

        await Subscription.findOneAndUpdate(
            { userId, status: "PENDING" },
            {
                userId,
                plan,
                status: "PENDING",
                razorpay: { orderId: order.id },
                amount,
                billingCycle
            },
            { upsert: true, new: true }
        );

        return res.status(200).json({
            success: true,
            data: {
                orderId: order.id,
                amount,
                currency: "INR",
                razorpayKeyId: process.env.RAZORPAY_KEY_ID,
                plan,
                billingCycle
            }
        });
    } catch (err) {
        console.error("Create order error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to create order",
            error: err.message
        });
    }
};

const verifyPayment = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const userId = req.user.id;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "Missing payment verification fields"
            });
        }

        const isValid = verifyRazorpaySignature(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        );

        if (!isValid) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "Payment signature verification failed"
            });
        }

        const subscription = await Subscription.findOne({
            userId,
            "razorpay.orderId": razorpay_order_id,
            status: "PENDING"
        }).session(session);

        if (!subscription) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: "Pending subscription not found for this order"
            });
        }

        const now = new Date();
        const periodEnd = new Date(now);
        if (subscription.billingCycle === "MONTHLY") {
            periodEnd.setMonth(periodEnd.getMonth() + 1);
        } else {
            periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        }

        subscription.status = "ACTIVE";
        subscription.razorpay.paymentId = razorpay_payment_id;
        subscription.razorpay.signature = razorpay_signature;
        subscription.currentPeriodStart = now;
        subscription.currentPeriodEnd = periodEnd;
        subscription.usage = { eventsCreated: 0, lastResetAt: now };

        const user = await User.findById(userId);
        if (!user) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        let platformUser = await EventPlatformUser.findOne({ userId }).session(session);
        const tempPassword = generateTempPassword();
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        if (!platformUser) {
            const platformId = generatePlatformId();
            platformUser = new EventPlatformUser({
                platformId,
                userId,
                email: user.email,
                password: hashedPassword,
                fullName: user.fullName,
                avatar: user.avatar || null,
                subscription: subscription._id,
                status: "ACTIVE"
            });
            await platformUser.save({ session });
        } else {
            platformUser.subscription = subscription._id;
            platformUser.status = "ACTIVE";
            platformUser.password = hashedPassword;
            platformUser.gracePeriodEndsAt = null;
            await platformUser.save({ session });
        }

        subscription.epuId = platformUser._id;

        const { keyString, jti, expiresAt } = generateApiKey(
            userId,
            platformUser._id,
            subscription.plan
        );

        const apiKeyDoc = new ApiKey({
            jti,
            userId,
            epuId: platformUser._id,
            tier: subscription.plan,
            status: "ACTIVE",
            expiresAt
        });
        await apiKeyDoc.save({ session });

        platformUser.apiKey = apiKeyDoc._id;
        await platformUser.save({ session });

        await subscription.save({ session });

        await session.commitTransaction();
        session.endSession();

        sendEmail({
            to: user.email,
            subject: "Your Event Platform Account is Ready!",
            template: "apiPlatformWelcome",
            data: {
                fullName: user.fullName,
                platformId: platformUser.platformId,
                tempPassword,
                apiKey: keyString,
                tier: subscription.plan,
                loginUrl: process.env.PLATFORM_DASHBOARD_URL || "https://platform.hackbytecodex.com"
            }
        }).catch((err) => console.error("Welcome email failed:", err));

        return res.status(200).json({
            success: true,
            message: "Payment verified. Your Event Platform account is ready.",
            data: {
                apiKey: keyString,
                platformId: platformUser.platformId,
                plan: subscription.plan,
                expiresAt,
                billingCycle: subscription.billingCycle,
                currentPeriodEnd: periodEnd
            }
        });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        console.error("Verify payment error:", err);
        return res.status(500).json({
            success: false,
            message: "Payment verification failed",
            error: err.message
        });
    }
};

const getSubscription = async (req, res) => {
    try {
        const userId = req.user.id;

        const subscription = await Subscription.findOne({
            userId,
            status: { $in: ["ACTIVE", "CANCELLED", "PAST_DUE"] }
        }).sort({ createdAt: -1 });

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: "No subscription found"
            });
        }

        const limits = API_TIER_LIMITS[subscription.plan];

        return res.status(200).json({
            success: true,
            data: {
                plan: subscription.plan,
                status: subscription.status,
                billingCycle: subscription.billingCycle,
                currentPeriodStart: subscription.currentPeriodStart,
                currentPeriodEnd: subscription.currentPeriodEnd,
                usage: subscription.usage,
                limits,
                cancelledAt: subscription.cancelledAt
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch subscription",
            error: err.message
        });
    }
};

const cancelSubscription = async (req, res) => {
    try {
        const platformUserId = req.platformUser.id;

        const subscription = await Subscription.findOne({
            epuId: platformUserId,
            status: "ACTIVE"
        });

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: "No active subscription found"
            });
        }

        subscription.status = "CANCELLED";
        subscription.cancelledAt = new Date();
        await subscription.save();

        return res.status(200).json({
            success: true,
            message: "Subscription cancelled. Access continues until period end.",
            data: {
                cancelledAt: subscription.cancelledAt,
                accessUntil: subscription.currentPeriodEnd
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to cancel subscription",
            error: err.message
        });
    }
};

const rotateApiKey = async (req, res) => {
    try {
        const platformUserId = req.platformUser.id;

        const platformUser = await EventPlatformUser.findById(platformUserId);
        if (!platformUser) {
            return res.status(404).json({
                success: false,
                message: "Platform user not found"
            });
        }

        const subscription = await Subscription.findOne({
            epuId: platformUserId,
            status: { $in: ["ACTIVE", "PAST_DUE"] }
        });

        if (!subscription) {
            return res.status(402).json({
                success: false,
                message: "Active subscription required to rotate key"
            });
        }

        const oldKey = await ApiKey.findOne({
            epuId: platformUserId,
            status: "ACTIVE"
        });

        const { keyString, jti, expiresAt } = generateApiKey(
            platformUser.userId,
            platformUserId,
            subscription.plan
        );

        const newKeyDoc = new ApiKey({
            jti,
            userId: platformUser.userId,
            epuId: platformUserId,
            tier: subscription.plan,
            status: "ACTIVE",
            expiresAt,
            rotatedFrom: oldKey?._id || null
        });
        await newKeyDoc.save();

        if (oldKey) {
            oldKey.status = "REVOKED";
            oldKey.rotatedTo = newKeyDoc._id;
            await oldKey.save();
        }

        platformUser.apiKey = newKeyDoc._id;
        await platformUser.save();

        sendEmail({
            to: platformUser.email,
            subject: "Your API Key Has Been Rotated",
            template: "apiKeyRotated",
            data: {
                fullName: platformUser.fullName,
                newApiKey: keyString,
                rotatedAt: new Date().toISOString(),
                dashboardUrl: process.env.PLATFORM_DASHBOARD_URL || "https://platform.hackbytecodex.com"
            }
        }).catch((err) => console.error("Key rotation email failed:", err));

        return res.status(200).json({
            success: true,
            message: "API key rotated successfully. Old key has been revoked.",
            data: {
                apiKey: keyString,
                expiresAt
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to rotate API key",
            error: err.message
        });
    }
};

const handleWebhook = async (req, res) => {
    try {
        const signature = req.headers["x-razorpay-signature"];
        const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

        if (!signature || !verifyWebhookSignature(rawBody, signature)) {
            return res.status(400).json({ success: false, message: "Invalid webhook signature" });
        }

        const event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        const eventType = event.event;
        const payload = event.payload;

        switch (eventType) {
            case "payment.captured": {
                const paymentEntity = payload.payment?.entity;
                if (paymentEntity?.notes?.userId) {
                    await Subscription.findOneAndUpdate(
                        {
                            "razorpay.orderId": paymentEntity.order_id,
                            status: "PENDING"
                        },
                        {
                            status: "ACTIVE",
                            "razorpay.paymentId": paymentEntity.id
                        }
                    );
                }
                break;
            }

            case "subscription.charged": {
                const subEntity = payload.subscription?.entity;
                if (subEntity) {
                    const sub = await Subscription.findOne({
                        "razorpay.subscriptionId": subEntity.id
                    });
                    if (sub) {
                        const now = new Date();
                        const periodEnd = new Date(now);
                        if (sub.billingCycle === "MONTHLY") {
                            periodEnd.setMonth(periodEnd.getMonth() + 1);
                        } else {
                            periodEnd.setFullYear(periodEnd.getFullYear() + 1);
                        }
                        sub.status = "ACTIVE";
                        sub.currentPeriodStart = now;
                        sub.currentPeriodEnd = periodEnd;
                        sub.usage = { eventsCreated: 0, lastResetAt: now };
                        await sub.save();
                    }
                }
                break;
            }

            case "subscription.halted":
            case "payment.failed": {
                const subEntity = payload.subscription?.entity;
                if (subEntity) {
                    const sub = await Subscription.findOne({
                        "razorpay.subscriptionId": subEntity.id
                    });
                    if (sub) {
                        sub.status = "PAST_DUE";
                        await sub.save();

                        if (sub.epuId) {
                            const gracePeriodEnd = new Date();
                            gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);
                            await EventPlatformUser.findByIdAndUpdate(sub.epuId, {
                                status: "SUSPENDED",
                                gracePeriodEndsAt: gracePeriodEnd
                            });
                        }
                    }
                }
                break;
            }

            case "subscription.cancelled": {
                const subEntity = payload.subscription?.entity;
                if (subEntity) {
                    await Subscription.findOneAndUpdate(
                        { "razorpay.subscriptionId": subEntity.id },
                        { status: "CANCELLED", cancelledAt: new Date() }
                    );
                }
                break;
            }
        }

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error("Webhook error:", err);
        return res.status(500).json({ success: false });
    }
};

module.exports = {
    createOrder,
    verifyPayment,
    getSubscription,
    cancelSubscription,
    rotateApiKey,
    handleWebhook
};
