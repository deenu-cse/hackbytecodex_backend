const mongoose = require("mongoose");
const ApiEvent = require("../../models/api/ApiEvent");
const ApiEventRegistration = require("../../models/api/ApiEventRegistration");
const ApiScore = require("../../models/api/ApiScore");
const ApiJudge = require("../../models/api/ApiJudge");
const Subscription = require("../../models/api/Subscription");
const { API_TIER_LIMITS } = require("../../constants/allConstant");

const getDashboard = async (req, res) => {
    try {
        const platformUserId = req.platformUser.id;
        const epuObjectId = new mongoose.Types.ObjectId(platformUserId);

        const [
            totalEvents,
            activeEvents,
            totalRegistrations,
            activeJudges,
            recentEvents
        ] = await Promise.all([
            ApiEvent.countDocuments({
                platformUser: platformUserId,
                status: { $ne: "CANCELLED" }
            }),
            ApiEvent.countDocuments({
                platformUser: platformUserId,
                status: "PUBLISHED"
            }),
            ApiEventRegistration.countDocuments({
                platformUser: platformUserId,
                status: "REGISTERED"
            }),
            ApiJudge.countDocuments({
                platformUser: platformUserId,
                status: { $in: ["INVITED", "ACTIVE"] }
            }),
            ApiEvent.find({ platformUser: platformUserId })
                .sort({ createdAt: -1 })
                .limit(5)
                .select("title slug status participantsCount eventType createdAt")
                .lean()
        ]);

        const subscription = await Subscription.findOne({
            epuId: platformUserId,
            status: { $in: ["ACTIVE", "PAST_DUE", "CANCELLED"] }
        }).sort({ createdAt: -1 });

        const limits = subscription
            ? API_TIER_LIMITS[subscription.plan]
            : null;

        return res.status(200).json({
            success: true,
            data: {
                stats: {
                    totalEvents,
                    activeEvents,
                    totalRegistrations,
                    activeJudges
                },
                planUsage: subscription
                    ? {
                          plan: subscription.plan,
                          eventsUsed: subscription.usage.eventsCreated,
                          eventsLimit: limits?.eventsPerMonth,
                          status: subscription.status,
                          periodEnd: subscription.currentPeriodEnd
                      }
                    : null,
                recentEvents
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch dashboard",
            error: err.message
        });
    }
};

const getEventOverview = async (req, res) => {
    try {
        const { eventId } = req.params;
        const platformUserId = req.platformUser.id;

        const event = await ApiEvent.findOne({
            _id: eventId,
            platformUser: platformUserId
        });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        const eventObjectId = new mongoose.Types.ObjectId(eventId);

        const [overview] = await ApiEventRegistration.aggregate([
            { $match: { event: eventObjectId } },
            {
                $facet: {
                    summary: [
                        {
                            $group: {
                                _id: null,
                                totalRegistrations: { $sum: 1 },
                                attended: {
                                    $sum: {
                                        $cond: ["$attendance.marked", 1, 0]
                                    }
                                },
                                paid: {
                                    $sum: {
                                        $cond: [
                                            { $eq: ["$payment.status", "PAID"] },
                                            1,
                                            0
                                        ]
                                    }
                                },
                                free: {
                                    $sum: {
                                        $cond: [
                                            { $eq: ["$payment.status", "FREE"] },
                                            1,
                                            0
                                        ]
                                    }
                                },
                                cancelled: {
                                    $sum: {
                                        $cond: [
                                            { $eq: ["$status", "CANCELLED"] },
                                            1,
                                            0
                                        ]
                                    }
                                },
                                avgScore: { $avg: "$performance.finalScore" },
                                totalRevenue: { $sum: "$payment.amount" }
                            }
                        }
                    ],
                    timeline: [
                        {
                            $group: {
                                _id: {
                                    $dateToString: {
                                        format: "%Y-%m-%d",
                                        date: "$createdAt"
                                    }
                                },
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { _id: 1 } },
                        {
                            $project: {
                                date: "$_id",
                                count: 1,
                                _id: 0
                            }
                        }
                    ],
                    statusBreakdown: [
                        {
                            $group: {
                                _id: "$status",
                                count: { $sum: 1 }
                            }
                        }
                    ]
                }
            }
        ]);

        const summary = overview?.summary?.[0] || {
            totalRegistrations: 0,
            attended: 0,
            paid: 0,
            free: 0,
            cancelled: 0,
            avgScore: null,
            totalRevenue: 0
        };

        return res.status(200).json({
            success: true,
            data: {
                event: {
                    id: event._id,
                    title: event.title,
                    status: event.status,
                    participantsCount: event.participantsCount
                },
                summary: {
                    ...summary,
                    attendanceRate: summary.totalRegistrations > 0
                        ? Math.round(
                              (summary.attended / summary.totalRegistrations) * 100
                          )
                        : 0
                },
                timeline: overview?.timeline || [],
                statusBreakdown: overview?.statusBreakdown || []
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch event overview",
            error: err.message
        });
    }
};

const getRegistrationTrends = async (req, res) => {
    try {
        const { eventId } = req.params;
        const platformUserId = req.platformUser.id;
        const { granularity = "daily" } = req.query;

        const event = await ApiEvent.findOne({
            _id: eventId,
            platformUser: platformUserId
        });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        let dateFormat;
        switch (granularity) {
            case "weekly":
                dateFormat = "%Y-W%V";
                break;
            case "monthly":
                dateFormat = "%Y-%m";
                break;
            default:
                dateFormat = "%Y-%m-%d";
        }

        const trends = await ApiEventRegistration.aggregate([
            {
                $match: {
                    event: new mongoose.Types.ObjectId(eventId)
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: dateFormat,
                            date: "$createdAt"
                        }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } },
            {
                $project: {
                    period: "$_id",
                    count: 1,
                    _id: 0
                }
            }
        ]);

        return res.status(200).json({
            success: true,
            data: trends
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch registration trends",
            error: err.message
        });
    }
};

const getFormBreakdown = async (req, res) => {
    try {
        const { eventId } = req.params;
        const platformUserId = req.platformUser.id;

        const event = await ApiEvent.findOne({
            _id: eventId,
            platformUser: platformUserId
        });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        const breakdown = await ApiEventRegistration.aggregate([
            {
                $match: {
                    event: new mongoose.Types.ObjectId(eventId)
                }
            },
            {
                $project: {
                    formDataArray: { $objectToArray: "$formData" }
                }
            },
            { $unwind: "$formDataArray" },
            {
                $group: {
                    _id: {
                        field: "$formDataArray.k",
                        value: "$formDataArray.v"
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id.field": 1, count: -1 } },
            {
                $group: {
                    _id: "$_id.field",
                    options: {
                        $push: {
                            value: "$_id.value",
                            count: "$count"
                        }
                    },
                    totalResponses: { $sum: "$count" }
                }
            },
            {
                $project: {
                    field: "$_id",
                    options: { $slice: ["$options", 20] },
                    totalResponses: 1,
                    _id: 0
                }
            }
        ]);

        return res.status(200).json({
            success: true,
            data: breakdown
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch form breakdown",
            error: err.message
        });
    }
};

const getScoringAnalytics = async (req, res) => {
    try {
        const { eventId } = req.params;
        const platformUserId = req.platformUser.id;

        const event = await ApiEvent.findOne({
            _id: eventId,
            platformUser: platformUserId
        });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        const analytics = await ApiScore.aggregate([
            {
                $match: {
                    event: new mongoose.Types.ObjectId(eventId)
                }
            },
            {
                $lookup: {
                    from: "apijudges",
                    localField: "judge",
                    foreignField: "_id",
                    as: "judgeInfo"
                }
            },
            { $unwind: "$judgeInfo" },
            {
                $group: {
                    _id: "$judge",
                    judgeName: { $first: "$judgeInfo.name" },
                    judgeEmail: { $first: "$judgeInfo.email" },
                    avgScore: { $avg: "$total" },
                    minScore: { $min: "$total" },
                    maxScore: { $max: "$total" },
                    scoredCount: { $sum: 1 },
                    stdDev: { $stdDevPop: "$total" }
                }
            },
            {
                $project: {
                    judgeName: 1,
                    judgeEmail: 1,
                    avgScore: { $round: ["$avgScore", 2] },
                    minScore: { $round: ["$minScore", 2] },
                    maxScore: { $round: ["$maxScore", 2] },
                    scoredCount: 1,
                    stdDev: { $round: ["$stdDev", 2] },
                    consistency: {
                        $round: [
                            {
                                $subtract: [
                                    1,
                                    {
                                        $divide: [
                                            "$stdDev",
                                            { $max: [event.scoring?.maxScore || 100, 1] }
                                        ]
                                    }
                                ]
                            },
                            2
                        ]
                    }
                }
            },
            { $sort: { avgScore: -1 } }
        ]);

        const overallStats = await ApiScore.aggregate([
            {
                $match: {
                    event: new mongoose.Types.ObjectId(eventId)
                }
            },
            {
                $group: {
                    _id: null,
                    totalScores: { $sum: 1 },
                    avgScore: { $avg: "$total" },
                    lockedCount: {
                        $sum: { $cond: ["$locked", 1, 0] }
                    }
                }
            }
        ]);

        return res.status(200).json({
            success: true,
            data: {
                judges: analytics,
                overall: overallStats[0] || {
                    totalScores: 0,
                    avgScore: 0,
                    lockedCount: 0
                }
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch scoring analytics",
            error: err.message
        });
    }
};

const compareEvents = async (req, res) => {
    try {
        const platformUserId = req.platformUser.id;
        const { eventIds } = req.query;

        if (!eventIds) {
            return res.status(400).json({
                success: false,
                message: "eventIds query param is required (comma-separated)"
            });
        }

        const ids = eventIds
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
            .map((id) => new mongoose.Types.ObjectId(id));

        if (ids.length === 0 || ids.length > 10) {
            return res.status(400).json({
                success: false,
                message: "Provide 1-10 event IDs"
            });
        }

        const comparison = await ApiEvent.aggregate([
            {
                $match: {
                    _id: { $in: ids },
                    platformUser: new mongoose.Types.ObjectId(platformUserId)
                }
            },
            {
                $lookup: {
                    from: "apieventregistrations",
                    let: { eventId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$event", "$$eventId"] }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                total: { $sum: 1 },
                                attended: {
                                    $sum: {
                                        $cond: ["$attendance.marked", 1, 0]
                                    }
                                },
                                avgScore: { $avg: "$performance.finalScore" },
                                completed: {
                                    $sum: {
                                        $cond: [
                                            { $eq: ["$status", "COMPLETED"] },
                                            1,
                                            0
                                        ]
                                    }
                                }
                            }
                        }
                    ],
                    as: "regStats"
                }
            },
            { $unwind: { path: "$regStats", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    title: 1,
                    eventType: 1,
                    status: 1,
                    startDate: 1,
                    participantsCount: 1,
                    totalRegistrations: {
                        $ifNull: ["$regStats.total", 0]
                    },
                    attendanceCount: {
                        $ifNull: ["$regStats.attended", 0]
                    },
                    avgScore: {
                        $round: [{ $ifNull: ["$regStats.avgScore", 0] }, 2]
                    },
                    completionRate: {
                        $cond: [
                            {
                                $gt: [
                                    { $ifNull: ["$regStats.total", 0] },
                                    0
                                ]
                            },
                            {
                                $round: [
                                    {
                                        $multiply: [
                                            {
                                                $divide: [
                                                    {
                                                        $ifNull: [
                                                            "$regStats.completed",
                                                            0
                                                        ]
                                                    },
                                                    "$regStats.total"
                                                ]
                                            },
                                            100
                                        ]
                                    },
                                    1
                                ]
                            },
                            0
                        ]
                    }
                }
            },
            { $sort: { avgScore: -1 } }
        ]);

        return res.status(200).json({
            success: true,
            data: comparison
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to compare events",
            error: err.message
        });
    }
};

module.exports = {
    getDashboard,
    getEventOverview,
    getRegistrationTrends,
    getFormBreakdown,
    getScoringAnalytics,
    compareEvents
};
