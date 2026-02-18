const Judge = require("../../models/judge");
const Event = require("../../models/event");
const Score = require("../../models/score");
const mongoose = require("mongoose");
const eventRegistration = require("../../models/eventRegistration");

const calculateScore = (c) =>
    c.innovation * 0.4 +
    c.technical * 0.3 +
    c.presentation * 0.2 +
    c.design * 0.1;

const assignJudge = async (req, res) => {
    try {

        const { userId } = req.body;
        const { eventId } = req.params;

        const event = await Event.findById(eventId);
        if (!event)
            return res.status(404).json({ success: false, message: "Event not found" });

        let judge = await Judge.findOne({ user: userId });

        if (judge) {

            if (!judge.events.includes(eventId)) {
                judge.events.push(eventId);
                await judge.save();
            }

        } else {

            judge = await Judge.create({
                user: userId,
                events: [eventId]
            });

        }

        res.json({ success: true, data: judge });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
};

const submitScore = async (req, res) => {
    try {

        const { registrationId, criteria, feedback } = req.body;

        const registration = await eventRegistration
            .findById(registrationId);

        if (!registration)
            return res.status(404).json({
                success: false,
                message: "Registration not found"
            });

        const judge = await Judge.findOne({
            user: req.user.id,
            events: registration.event,
            isActive: true
        });

        if (!judge)
            return res.status(403).json({
                success: false,
                message: "You are not assigned as judge"
            });

        const existingScore = await Score.findOne({
            registration: registrationId,
            judge: judge._id
        });

        if (existingScore?.locked)
            return res.status(403).json({
                success: false,
                message: "Scores locked"
            });

        const total = calculateScore(criteria);

        const score = await Score.findOneAndUpdate(
            {
                registration: registrationId,
                judge: judge._id
            },
            {
                event: registration.event,
                criteria,
                total,
                feedback
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            }
        );

        res.json({ success: true, data: score });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
};

const LockScoresForEvent = async (req, res) => {
    const session = await mongoose.startSession();
    try {

        session.startTransaction();

        const { eventId } = req.params;

        const event = await Event.findById(eventId).session(session);

        if (!event)
            throw new Error("Event not found");

        if (event.status === "COMPLETED")
            return res.status(400).json({
                success: false,
                message: "Event already finalized"
            });

        const leaderboard = await Score.aggregate([
            {
                $match: { event: new mongoose.Types.ObjectId(eventId) }
            },
            {
                $group: {
                    _id: "$participant",
                    totalScore: { $sum: "$score" }
                }
            },
            {
                $sort: { totalScore: -1 }
            }
        ]).session(session);

        if (!leaderboard.length)
            throw new Error("No scores found");

        const prizes = ["Gold 🥇", "Silver 🥈", "Bronze 🥉"];
        const rewardPoints = [100, 70, 50];

        for (let i = 0; i < Math.min(3, leaderboard.length); i++) {

            await eventRegistration.updateOne(
                {
                    event: eventId,
                    participant: leaderboard[i]._id
                },
                {
                    $set: {
                        result: {
                            position: i + 1,
                            isWinner: true,
                            prize: prizes[i]
                        },
                        rewardPoints: rewardPoints[i]
                    }
                },
                { session }
            );
        }

        await Score.updateMany(
            { event: eventId },
            { locked: true },
            { session }
        );

        event.status = "COMPLETED";
        await event.save({ session });

        await session.commitTransaction();

        res.json({
            success: true,
            message: "Event finalized successfully "
        });

    } catch (err) {

        await session.abortTransaction();

        res.status(500).json({
            success: false,
            message: err.message
        });

    } finally {
        session.endSession();
    }
};

const generateLeaderboard = async (req, res) => {
    try {

        const { eventId } = req.params;

        if (!eventId) {
            return res.status(400).json({
                success: false,
                message: "Event ID is required"
            });
        }

        const leaderboard = await Score.aggregate([

            {
                $match: {
                    event: new mongoose.Types.ObjectId(eventId)
                }
            },

            {
                $group: {
                    _id: "$registration",
                    avgScore: { $avg: "$total" },
                    judges: { $sum: 1 }
                }
            },

            { $sort: { avgScore: -1 } },

            {
                $lookup: {
                    from: "eventregistrations",
                    localField: "_id",
                    foreignField: "_id",
                    as: "reg"
                }
            },

            { $unwind: "$reg" },

            {
                $lookup: {
                    from: "users",
                    localField: "reg.user",
                    foreignField: "_id",
                    as: "user"
                }
            },

            { $unwind: "$user" },

            {
                $project: {
                    name: "$user.name",
                    avgScore: { $round: ["$avgScore", 2] },
                    judges: 1
                }
            }

        ]);

        const ranked = leaderboard.map((p, i) => ({
            rank: i + 1,
            ...p
        }));

        return res.status(200).json({
            success: true,
            data: ranked
        });

    } catch (err) {
        console.error("Generate Leaderboard Error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while generating leaderboard",
            error: err.message
        });
    }
};

const getEventJudges = async (req, res) => {
    try {
        console.log("getEventJudges controller hit");
        
        const { eventId } = req.params;

        if (!eventId) {
            return res.status(400).json({
                success: false,
                message: "Event ID is required"
            });
        }

        const judges = await Judge.find({ events: eventId })
            .populate('user', 'fullName email avatar')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: judges
        });
    } catch (err) {
        console.error("Get Event Judges Error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching judges",
            error: err.message
        });
    }
};

const verifyJudge = async (req, res) => {
    try {
        const { eventId } = req.params;
        
        if (!eventId) {
            return res.status(400).json({
                success: false,
                message: "Event ID is required"
            });
        }

        console.log("Verifying judge for event:", eventId, "User ID:", req.user.id);
        
        const judge = await Judge.findOne({
            user: req.user.id,
            events: eventId,
            isActive: true
        });

        if (!judge) {
            return res.status(403).json({
                success: false,
                message: "You are not assigned as a judge for this event"
            });
        }

        return res.status(200).json({
            success: true,
            data: judge
        });
    } catch (err) {
        console.error("Verify Judge Error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while verifying judge",
            error: err.message
        });
    }
};

const getJudgeScores = async (req, res) => {
    try {
        const { eventId } = req.params;

        if (!eventId) {
            return res.status(400).json({
                success: false,
                message: "Event ID is required"
            });
        }

        const judge = await Judge.findOne({
            user: req.user.id,
            events: eventId
        });

        if (!judge) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to view these scores"
            });
        }

        const scores = await Score.find({
            judge: judge._id,
            event: eventId
        });

        return res.status(200).json({
            success: true,
            data: scores
        });
    } catch (err) {
        console.error("Get Judge Scores Error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching scores",
            error: err.message
        });
    }
};

const getLeaderboard = async (req, res) => {
    try {
        const { eventId } = req.params;

        if (!eventId) {
            return res.status(400).json({
                success: false,
                message: "Event ID is required"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid event ID format"
            });
        }

        const unlockedExists = await Score.exists({
            event: eventId,
            locked: false
        });

        const locked = !unlockedExists;

        const leaderboard = await Score.aggregate([
            { $match: { event: new mongoose.Types.ObjectId(eventId) } },
            {
                $group: {
                    _id: "$registration",
                    avgScore: { $avg: "$total" },
                    judges: { $sum: 1 }
                }
            },
            { $sort: { avgScore: -1 } },
            {
                $lookup: {
                    from: "eventregistrations",
                    localField: "_id",
                    foreignField: "_id",
                    as: "reg"
                }
            },
            { $unwind: "$reg" },
            {
                $lookup: {
                    from: "users",
                    localField: "reg.user",
                    foreignField: "_id",
                    as: "user"
                }
            },
            { $unwind: "$user" },
            {
                $project: {
                    name: "$user.fullName",
                    teamName: "$reg.formData.teamName",
                    avgScore: { $round: ["$avgScore", 2] },
                    judges: 1
                }
            },
            {
                $sort: {
                    avgScore: -1,
                    judges: -1
                }
            }
        ]);

        let rank = 1;

        const ranked = leaderboard.map((p, i) => {
            if (i > 0 && p.avgScore < leaderboard[i - 1].avgScore) {
                rank = i + 1;
            }

            return { rank, ...p };
        });

        return res.status(200).json({
            success: true,
            data: ranked,
            locked
        });
    } catch (err) {
        console.error("Get Leaderboard Error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching leaderboard",
            error: err.message
        });
    }
};

const getGlobalLeaderboard = async (req, res) => {
    try {

        const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 10, 100));

        const leaderboard = await Score.aggregate([

            {
                $match: {
                    locked: true
                }
            },

            {
                $lookup: {
                    from: "eventregistrations",
                    localField: "registration",
                    foreignField: "_id",
                    as: "registration"
                }
            },
            { $unwind: "$registration" },

            {
                $group: {
                    _id: "$registration.user",

                    totalScore: { $sum: "$total" },

                    avgScore: { $avg: "$total" },

                    eventsParticipated: {
                        $addToSet: "$event"
                    }
                }
            },

            {
                $addFields: {
                    eventsCount: { $size: "$eventsParticipated" }
                }
            },

            {
                $sort: { totalScore: -1 }
            },

            { $limit: limit },

            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "user"
                }
            },
            { $unwind: "$user" },

            {
                $project: {
                    _id: 0,
                    userId: "$user._id",
                    name: "$user.fullName",

                    totalScore: { $round: ["$totalScore", 2] },
                    avgScore: { $round: ["$avgScore", 2] },

                    eventsCount: 1
                }
            }
        ]);

        const ranked = leaderboard.map((u, index) => ({
            rank: index + 1,
            ...u
        }));

        return res.status(200).json({
            success: true,
            data: ranked
        });

    } catch (error) {

        console.error("Get Global Leaderboard Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while generating global leaderboard",
            error: error.message
        });
    }
};

module.exports = {
    assignJudge,
    submitScore,
    LockScoresForEvent,
    generateLeaderboard,
    getEventJudges,
    verifyJudge,
    getJudgeScores,
    getLeaderboard,
    getGlobalLeaderboard
}