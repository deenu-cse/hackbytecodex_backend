const { API_TIER_LIMITS, ANALYTICS_LEVEL_HIERARCHY } = require("../../constants/allConstant");
const ApiEvent = require("../../models/api/ApiEvent");
const ApiEventRegistration = require("../../models/api/ApiEventRegistration");
const ApiJudge = require("../../models/api/ApiJudge");
const Subscription = require("../../models/api/Subscription");

const tierGuard = (resourceType, requiredLevel) => {
    return async (req, res, next) => {
        try {
            const platformUserId = req.platformUser?.id;
            if (!platformUserId) {
                return res.status(401).json({
                    success: false,
                    message: "Platform authentication required"
                });
            }

            const subscription = await Subscription.findOne({
                epuId: platformUserId,
                status: { $in: ["ACTIVE", "PAST_DUE"] }
            });

            if (!subscription) {
                return res.status(402).json({
                    success: false,
                    error: "NO_ACTIVE_SUBSCRIPTION",
                    message: "An active subscription is required"
                });
            }

            const limits = API_TIER_LIMITS[subscription.plan];
            if (!limits) {
                return res.status(500).json({
                    success: false,
                    message: "Invalid subscription plan"
                });
            }

            switch (resourceType) {
                case "events": {
                    if (limits.eventsPerMonth === null) break;
                    const eventCount = await ApiEvent.countDocuments({
                        platformUser: platformUserId,
                        status: { $ne: "CANCELLED" },
                        createdAt: { $gte: subscription.usage.lastResetAt }
                    });
                    if (eventCount >= limits.eventsPerMonth) {
                        return res.status(403).json({
                            success: false,
                            error: "LIMIT_EXCEEDED",
                            message: `Your ${subscription.plan} plan allows ${limits.eventsPerMonth} events/month. Upgrade to create more.`,
                            current: eventCount,
                            limit: limits.eventsPerMonth
                        });
                    }
                    break;
                }

                case "registrations": {
                    if (limits.regsPerEvent === null) break;
                    const eventId = req.params.eventId;
                    const regCount = await ApiEventRegistration.countDocuments({
                        event: eventId,
                        status: { $ne: "CANCELLED" }
                    });
                    if (regCount >= limits.regsPerEvent) {
                        return res.status(403).json({
                            success: false,
                            error: "LIMIT_EXCEEDED",
                            message: `Your ${subscription.plan} plan allows ${limits.regsPerEvent} registrations/event. Upgrade for more.`,
                            current: regCount,
                            limit: limits.regsPerEvent
                        });
                    }
                    break;
                }

                case "judges": {
                    if (limits.judgesPerEvent === null) break;
                    const eventId = req.params.eventId;
                    const judgeCount = await ApiJudge.countDocuments({
                        event: eventId,
                        status: { $ne: "DEACTIVATED" }
                    });
                    if (judgeCount >= limits.judgesPerEvent) {
                        return res.status(403).json({
                            success: false,
                            error: "LIMIT_EXCEEDED",
                            message: `Your ${subscription.plan} plan allows ${limits.judgesPerEvent} judges/event. Upgrade for more.`,
                            current: judgeCount,
                            limit: limits.judgesPerEvent
                        });
                    }
                    break;
                }

                case "analytics": {
                    const level = requiredLevel || "BASIC";
                    const userLevel = ANALYTICS_LEVEL_HIERARCHY[limits.analyticsLevel] || 0;
                    const needed = ANALYTICS_LEVEL_HIERARCHY[level] || 0;
                    if (userLevel < needed) {
                        return res.status(403).json({
                            success: false,
                            error: "ANALYTICS_TIER_REQUIRED",
                            message: `This analytics feature requires a higher plan. Your plan: ${subscription.plan}.`
                        });
                    }
                    break;
                }
            }

            req.subscription = subscription;
            next();
        } catch (err) {
            return res.status(500).json({
                success: false,
                message: "Tier guard check failed",
                error: err.message
            });
        }
    };
};

module.exports = { tierGuard };
