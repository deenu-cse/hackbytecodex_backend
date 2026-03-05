const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { JWT, USER_TYPE } = require("../../constants/allConstant");
const ApiJudge = require("../../models/api/ApiJudge");
const ApiEvent = require("../../models/api/ApiEvent");
const ApiScore = require("../../models/api/ApiScore");
const ApiEventRegistration = require("../../models/api/ApiEventRegistration");
const sendEmail = require("../../utils/sendEmail");

const inviteJudge = async (req, res) => {
    try {
        const { eventId } = req.params;
        const platformUserId = req.platformUser.id;
        const { email, name, role } = req.body;

        if (!email || !name) {
            return res.status(400).json({
                success: false,
                message: "Judge email and name are required"
            });
        }

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

        const existing = await ApiJudge.findOne({
            event: eventId,
            email: email.toLowerCase().trim()
        });

        if (existing) {
            return res.status(409).json({
                success: false,
                message: "This judge is already invited to this event"
            });
        }

        const tempPassword = crypto.randomBytes(8).toString("hex");
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        const inviteToken = crypto.randomBytes(32).toString("hex");

        const judge = new ApiJudge({
            platformUser: platformUserId,
            event: eventId,
            email: email.toLowerCase().trim(),
            name,
            password: hashedPassword,
            role: role || "JUDGE",
            status: "INVITED",
            inviteToken,
            inviteTokenExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`
        });

        await judge.save();

        event.judges.push(judge._id);
        await event.save();

        sendEmail({
            to: email,
            subject: `You've been invited to judge: ${event.title}`,
            template: "judgeInvite",
            data: {
                judgeName: name,
                eventName: event.title,
                organizerName: req.platformUser.platformId,
                tempPassword,
                judgeLoginUrl: `${process.env.JUDGE_PANEL_URL || "https://judge.hackbytecodex.com"}/login`,
                eventDate: event.startDate
                    ? new Date(event.startDate).toLocaleDateString()
                    : "TBD"
            }
        }).catch((err) => console.error("Judge invite email failed:", err));

        return res.status(201).json({
            success: true,
            message: "Judge invited successfully. Credentials sent via email.",
            data: {
                judgeId: judge._id,
                email: judge.email,
                name: judge.name,
                role: judge.role,
                status: judge.status
            }
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "This judge is already assigned to this event"
            });
        }
        return res.status(500).json({
            success: false,
            message: "Failed to invite judge",
            error: err.message
        });
    }
};

const getJudges = async (req, res) => {
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

        const judges = await ApiJudge.find({ event: eventId }).select(
            "name email role status lastLogin createdAt"
        );

        return res.status(200).json({
            success: true,
            data: judges
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch judges",
            error: err.message
        });
    }
};

const deactivateJudge = async (req, res) => {
    try {
        const { eventId, judgeId } = req.params;
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

        const judge = await ApiJudge.findOneAndUpdate(
            { _id: judgeId, event: eventId },
            { status: "DEACTIVATED" },
            { new: true }
        );

        if (!judge) {
            return res.status(404).json({
                success: false,
                message: "Judge not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Judge deactivated successfully"
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to deactivate judge",
            error: err.message
        });
    }
};

const lockScores = async (req, res) => {
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

        const result = await ApiScore.updateMany(
            { event: eventId, locked: false },
            { locked: true }
        );

        return res.status(200).json({
            success: true,
            message: `${result.modifiedCount} scores locked successfully`
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to lock scores",
            error: err.message
        });
    }
};

const generateLeaderboard = async (req, res) => {
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

        const leaderboard = await ApiScore.aggregate([
            { $match: { event: new mongoose.Types.ObjectId(eventId) } },
            {
                $group: {
                    _id: "$registration",
                    avgScore: { $avg: "$total" },
                    totalJudges: { $sum: 1 },
                    scores: {
                        $push: {
                            judge: "$judge",
                            total: "$total",
                            criteria: "$criteria"
                        }
                    }
                }
            },
            { $sort: { avgScore: -1 } },
            {
                $lookup: {
                    from: "apieventregistrations",
                    localField: "_id",
                    foreignField: "_id",
                    as: "registration"
                }
            },
            { $unwind: "$registration" },
            {
                $project: {
                    registrationId: "$_id",
                    registrantName: "$registration.registrantName",
                    registrantEmail: "$registration.registrantEmail",
                    teamName: "$registration.teamName",
                    avgScore: { $round: ["$avgScore", 2] },
                    totalJudges: 1,
                    scores: 1
                }
            }
        ]);

        for (let i = 0; i < leaderboard.length; i++) {
            const position = i + 1;
            await ApiEventRegistration.findByIdAndUpdate(
                leaderboard[i].registrationId,
                {
                    "performance.finalScore": leaderboard[i].avgScore,
                    "result.position": position,
                    "result.isWinner": position <= 3
                }
            );
            leaderboard[i].position = position;
        }

        return res.status(200).json({
            success: true,
            message: "Leaderboard generated successfully",
            data: leaderboard
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to generate leaderboard",
            error: err.message
        });
    }
};

// --- Judge Auth & Panel ---

const judgeLogin = async (req, res) => {
    try {
        const { email, password, eventId } = req.body;

        if (!email || !password || !eventId) {
            return res.status(400).json({
                success: false,
                message: "Email, password, and event ID are required"
            });
        }

        const judge = await ApiJudge.findOne({
            email: email.toLowerCase().trim(),
            event: eventId,
            status: { $in: ["INVITED", "ACTIVE"] }
        }).select("+password");

        if (!judge) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials or judge not found for this event"
            });
        }

        const isMatch = await bcrypt.compare(password, judge.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const token = jwt.sign(
            {
                judgeId: judge._id,
                email: judge.email,
                role: USER_TYPE.API_JUDGE,
                eventId: judge.event.toString(),
                platformUserId: judge.platformUser.toString()
            },
            JWT.API_JUDGE_SECRET,
            { expiresIn: JWT.API_JUDGE_EXPIRE_IN }
        );

        judge.status = "ACTIVE";
        judge.lastLogin = new Date();
        await ApiJudge.findByIdAndUpdate(judge._id, {
            status: "ACTIVE",
            lastLogin: new Date()
        });

        const event = await ApiEvent.findById(eventId).select("title eventType startDate endDate");

        return res.status(200).json({
            success: true,
            data: {
                token,
                judge: {
                    id: judge._id,
                    name: judge.name,
                    email: judge.email,
                    role: judge.role
                },
                event: event
                    ? {
                          id: event._id,
                          title: event.title,
                          eventType: event.eventType,
                          startDate: event.startDate,
                          endDate: event.endDate
                      }
                    : null
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Judge login failed",
            error: err.message
        });
    }
};

const getJudgeRegistrations = async (req, res) => {
    try {
        const { eventId } = req.judge;

        const registrations = await ApiEventRegistration.find({
            event: eventId,
            status: "REGISTERED"
        })
            .select(
                "registrantName registrantEmail teamName formData performance.finalScore"
            )
            .lean();

        const existingScores = await ApiScore.find({
            event: eventId,
            judge: req.judge.id
        }).select("registration total");

        const scoredMap = {};
        for (const s of existingScores) {
            scoredMap[s.registration.toString()] = s.total;
        }

        const enriched = registrations.map((r) => ({
            ...r,
            scored: scoredMap[r._id.toString()] !== undefined,
            myScore: scoredMap[r._id.toString()] || null
        }));

        return res.status(200).json({
            success: true,
            data: enriched
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch registrations",
            error: err.message
        });
    }
};

const submitScore = async (req, res) => {
    try {
        const { eventId, id: judgeId } = req.judge;
        const { registrationId, criteria, feedback } = req.body;

        if (!registrationId || !criteria) {
            return res.status(400).json({
                success: false,
                message: "Registration ID and criteria scores are required"
            });
        }

        const event = await ApiEvent.findById(eventId);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        const registration = await ApiEventRegistration.findOne({
            _id: registrationId,
            event: eventId
        });

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: "Registration not found for this event"
            });
        }

        const existingLocked = await ApiScore.findOne({
            registration: registrationId,
            judge: judgeId,
            locked: true
        });

        if (existingLocked) {
            return res.status(403).json({
                success: false,
                message: "Score is locked and cannot be modified"
            });
        }

        let total = 0;
        if (event.scoring?.criteria?.length > 0) {
            const totalWeight = event.scoring.criteria.reduce((sum, c) => sum + c.weight, 0);
            for (const c of event.scoring.criteria) {
                const val = criteria[c.name] || 0;
                total += (val * c.weight) / (totalWeight || 1);
            }
        } else {
            const values = Object.values(criteria);
            total = values.length
                ? values.reduce((sum, v) => sum + (Number(v) || 0), 0) / values.length
                : 0;
        }

        total = Math.round(total * 100) / 100;

        const score = await ApiScore.findOneAndUpdate(
            { registration: registrationId, judge: judgeId },
            {
                event: eventId,
                registration: registrationId,
                judge: judgeId,
                platformUser: req.judge.platformUserId,
                criteria,
                total,
                feedback: feedback || "",
                locked: false
            },
            { upsert: true, new: true }
        );

        const judgeScoreEntry = {
            judge: judgeId,
            score: total,
            feedback: feedback || ""
        };

        await ApiEventRegistration.findByIdAndUpdate(registrationId, {
            $pull: { "performance.judgeScores": { judge: judgeId } }
        });
        await ApiEventRegistration.findByIdAndUpdate(registrationId, {
            $push: { "performance.judgeScores": judgeScoreEntry }
        });

        return res.status(200).json({
            success: true,
            message: "Score submitted successfully",
            data: {
                scoreId: score._id,
                total,
                criteria: score.criteria
            }
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Score already exists. Use PUT to update."
            });
        }
        return res.status(500).json({
            success: false,
            message: "Failed to submit score",
            error: err.message
        });
    }
};

const updateScore = async (req, res) => {
    try {
        const { scoreId } = req.params;
        const { criteria, feedback } = req.body;

        const score = await ApiScore.findOne({
            _id: scoreId,
            judge: req.judge.id
        });

        if (!score) {
            return res.status(404).json({
                success: false,
                message: "Score not found"
            });
        }

        if (score.locked) {
            return res.status(403).json({
                success: false,
                message: "Score is locked and cannot be modified"
            });
        }

        const event = await ApiEvent.findById(score.event);

        if (criteria) {
            score.criteria = criteria;

            let total = 0;
            if (event?.scoring?.criteria?.length > 0) {
                const totalWeight = event.scoring.criteria.reduce((sum, c) => sum + c.weight, 0);
                for (const c of event.scoring.criteria) {
                    const val = criteria[c.name] || 0;
                    total += (val * c.weight) / (totalWeight || 1);
                }
            } else {
                const values = Object.values(criteria);
                total = values.length
                    ? values.reduce((sum, v) => sum + (Number(v) || 0), 0) / values.length
                    : 0;
            }
            score.total = Math.round(total * 100) / 100;
        }

        if (feedback !== undefined) score.feedback = feedback;

        await score.save();

        await ApiEventRegistration.findOneAndUpdate(
            {
                _id: score.registration,
                "performance.judgeScores.judge": req.judge.id
            },
            {
                $set: {
                    "performance.judgeScores.$.score": score.total,
                    "performance.judgeScores.$.feedback": score.feedback
                }
            }
        );

        return res.status(200).json({
            success: true,
            message: "Score updated successfully",
            data: {
                scoreId: score._id,
                total: score.total,
                criteria: score.criteria
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to update score",
            error: err.message
        });
    }
};

const getJudgeLeaderboard = async (req, res) => {
    try {
        const { eventId } = req.judge;

        const leaderboard = await ApiScore.aggregate([
            { $match: { event: new mongoose.Types.ObjectId(eventId) } },
            {
                $group: {
                    _id: "$registration",
                    avgScore: { $avg: "$total" },
                    totalJudges: { $sum: 1 }
                }
            },
            { $sort: { avgScore: -1 } },
            {
                $lookup: {
                    from: "apieventregistrations",
                    localField: "_id",
                    foreignField: "_id",
                    as: "registration"
                }
            },
            { $unwind: "$registration" },
            {
                $project: {
                    registrantName: "$registration.registrantName",
                    teamName: "$registration.teamName",
                    avgScore: { $round: ["$avgScore", 2] },
                    totalJudges: 1
                }
            }
        ]);

        leaderboard.forEach((item, i) => {
            item.position = i + 1;
        });

        return res.status(200).json({
            success: true,
            data: leaderboard
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch leaderboard",
            error: err.message
        });
    }
};

module.exports = {
    inviteJudge,
    getJudges,
    deactivateJudge,
    lockScores,
    generateLeaderboard,
    judgeLogin,
    getJudgeRegistrations,
    submitScore,
    updateScore,
    getJudgeLeaderboard
};
