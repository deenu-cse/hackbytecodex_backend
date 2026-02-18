const Club = require("../../models/club");
const User = require("../../models/user")
const mongoose = require('mongoose')


const getAllClubs = async (req, res) => {
    try {

        let {
            page = 1,
            limit = 10,
            search,
            tier,
            minScore,
            maxScore,
            minRating,
            status,
            collegeId,
            sortBy = "createdAt"
        } = req.query;

        page = Number(page);
        limit = Number(limit);
        const skip = (page - 1) * limit;

        // ===== MATCH STAGE =====
        let match = {};

        if (search) {
            match.$text = { $search: search };
        }

        if (tier) {
            match["performance.tier"] = tier;
        }

        if (status) {
            match.status = status;
        }

        if (collegeId) {
            match["college.collegeId"] = new mongoose.Types.ObjectId(collegeId);
        }

        if (minScore || maxScore) {
            match["performance.score"] = {};
            if (minScore) match["performance.score"].$gte = Number(minScore);
            if (maxScore) match["performance.score"].$lte = Number(maxScore);
        }

        if (minRating) {
            match["performance.rating"] = { $gte: Number(minRating) };
        }

        let sort = {};

        switch (sortBy) {
            case "score":
                sort["performance.score"] = -1;
                break;

            case "rating":
                sort["performance.rating"] = -1;
                break;

            case "events":
                sort["stats.eventsHosted"] = -1;
                break;

            default:
                sort.createdAt = -1;
        }

        const clubs = await Club.aggregate([

            { $match: match },

            {
                $addFields: {
                    membersCount: { $size: "$members" },
                    adminsCount: { $size: "$admins" },
                    eventsCount: { $size: "$events" }
                }
            },

            { $sort: sort },

            {
                $facet: {
                    data: [
                        { $skip: skip },
                        { $limit: limit },

                        {
                            $project: {
                                name: 1,
                                code: 1,
                                logo: 1,
                                description: 1,
                                college: 1,
                                performance: 1,
                                rewards: "$rewards.points",
                                stats: 1,
                                membersCount: 1,
                                adminsCount: 1,
                                eventsCount: 1,
                                status: 1,
                                createdAt: 1
                            }
                        }
                    ],

                    totalCount: [
                        { $count: "count" }
                    ]
                }
            }
        ]);

        const total = clubs[0].totalCount[0]?.count || 0;

        return res.status(200).json({
            success: true,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit
            },
            data: clubs[0].data
        });

    } catch (error) {

        console.error("Get Clubs Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while fetching clubs"
        });
    }
};

const getClubsByCollege = async (req, res) => {
    try {

        const { collegeId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(collegeId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid collegeId"
            });
        }

        let {
            page = 1,
            limit = 10,
            search,
            tier,
            status,
            minScore,
            minRating,
            sortBy = "createdAt"
        } = req.query;

        page = Number(page);
        limit = Number(limit);

        const skip = (page - 1) * limit;

        let match = {
            "college.collegeId": new mongoose.Types.ObjectId(collegeId)
        };

        if (search) {
            match.$text = { $search: search };
        }

        if (tier) {
            match["performance.tier"] = tier;
        }

        if (status) {
            match.status = status;
        }

        if (minScore) {
            match["performance.score"] = { $gte: Number(minScore) };
        }

        if (minRating) {
            match["performance.rating"] = { $gte: Number(minRating) };
        }

        let sort = {};

        switch (sortBy) {

            case "score":
                sort["performance.score"] = -1;
                break;

            case "rating":
                sort["performance.rating"] = -1;
                break;

            case "events":
                sort["stats.eventsHosted"] = -1;
                break;

            default:
                sort.createdAt = -1;
        }

        const result = await Club.aggregate([

            { $match: match },

            {
                $addFields: {
                    membersCount: { $size: "$members" },
                    adminsCount: { $size: "$admins" },
                    eventsCount: { $size: "$events" }
                }
            },

            { $sort: sort },

            {
                $facet: {

                    data: [
                        { $skip: skip },
                        { $limit: limit },

                        {
                            $project: {
                                name: 1,
                                code: 1,
                                logo: 1,
                                description: 1,
                                performance: 1,
                                rewardsPoints: "$rewards.points",
                                stats: 1,
                                membersCount: 1,
                                adminsCount: 1,
                                eventsCount: 1,
                                status: 1,
                                createdAt: 1
                            }
                        }
                    ],

                    totalCount: [
                        { $count: "count" }
                    ]
                }
            }

        ]);

        const total = result[0].totalCount[0]?.count || 0;

        return res.status(200).json({
            success: true,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit
            },
            data: result[0].data
        });

    } catch (error) {

        console.error("Get Clubs By College Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while fetching clubs"
        });
    }
};

const getClubByCode = async (req, res) => {
    try {

        const { clubCode } = req.params;

        const clubData = await Club.aggregate([

            {
                $match: { code: clubCode.toUpperCase() }
            },

            { $limit: 1 },

            {
                $addFields: {
                    membersCount: { $size: "$members" },
                    adminsCount: { $size: "$admins" },
                    eventsCount: { $size: "$events" }
                }
            },

            {
                $lookup: {
                    from: "colleges",
                    localField: "college.collegeId",
                    foreignField: "_id",
                    as: "collegeInfo"
                }
            },
            { $unwind: "$collegeInfo" },

            // ===== ADMINS LOOKUP =====
            {
                $lookup: {
                    from: "users",
                    localField: "admins",
                    foreignField: "_id",
                    pipeline: [
                        {
                            $project: {
                                fullName: 1,
                                email: 1,
                                avatar: 1,
                                role: 1
                            }
                        }
                    ],
                    as: "adminsData"
                }
            },

            {
                $lookup: {
                    from: "events",
                    localField: "events",
                    foreignField: "_id",
                    pipeline: [
                        { $sort: { startDate: -1 } },
                        { $limit: 5 },
                        {
                            $project: {
                                title: 1,
                                banners: 1,
                                startDate: 1,
                                eventType: 1,
                                participantsCount: 1,
                                status: 1
                            }
                        }
                    ],
                    as: "recentEvents"
                }
            },

            {
                $setWindowFields: {
                    partitionBy: "$college.collegeId",
                    sortBy: { "performance.score": -1 },
                    output: {
                        rankInCollege: { $rank: {} }
                    }
                }
            },

            {
                $project: {

                    name: 1,
                    code: 1,
                    description: 1,
                    logo: 1,

                    performance: 1,
                    rewards: 1,
                    stats: 1,
                    status: 1,
                    createdAt: 1,

                    membersCount: 1,
                    adminsCount: 1,
                    eventsCount: 1,
                    rankInCollege: 1,

                    college: {
                        _id: "$collegeInfo._id",
                        name: "$collegeInfo.name",
                        logo: "$collegeInfo.logo",
                        website: "$collegeInfo.website"
                    },

                    admins: "$adminsData",
                    recentEvents: 1
                }
            }

        ]);

        if (!clubData.length) {
            return res.status(404).json({
                success: false,
                message: "Club not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: clubData[0]
        });

    } catch (error) {

        console.error("Get Club By Code Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while fetching club"
        });
    }
};

const getClubMembers = async (req, res) => {
    try {

        const { clubId } = req.params;

        let { page = 1, limit = 50, search = "" } = req.query;

        page = Number(page);
        limit = Number(limit);

        const club = await Club.findById(clubId).select("members");

        if (!club) {
            return res.status(404).json({
                success: false,
                message: "Club not found"
            });
        }

        const query = {
            _id: { $in: club.members },
            fullName: { $regex: search, $options: "i" }
        };

        const users = await User.find(query)
            .select("-password")
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await User.countDocuments(query);

        return res.status(200).json({
            success: true,
            total,
            page,
            pages: Math.ceil(total / limit),
            data: users
        });

    } catch (error) {

        console.error("Get Club Members Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

const assignClubAdmin = async (req, res) => {

    const session = await mongoose.startSession();
    session.startTransaction();

    try {

        const { clubId, userId } = req.body;

        if (!clubId || !userId) {
            return res.status(400).json({
                success: false,
                message: "clubId and userId are required"
            });
        }

        const club = await Club.findById(clubId).session(session);

        if (!club) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: "Club not found"
            });
        }

        const user = await User.findById(userId).session(session);

        if (!user) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (
            user.college?.collegeId?.toString() !==
            club.college.collegeId.toString()
        ) {
            await session.abortTransaction();
            return res.status(403).json({
                success: false,
                message: "User must belong to same college as club"
            });
        }

        if (club.admins.includes(user._id)) {
            await session.abortTransaction();
            return res.status(409).json({
                success: false,
                message: "User is already a club admin"
            });
        }

        club.admins.push(user._id);

        if (!club.members.includes(user._id)) {
            club.members.push(user._id);
            club.stats.activeMembers += 1;
        }

        await club.save({ session });


        const alreadyInClub = user.clubs.some(
            c => c.clubId.toString() === clubId
        );

        if (!alreadyInClub) {
            user.clubs.push({
                clubId,
                role: "CLUB_ADMIN"
            });
        } else {
            user.clubs = user.clubs.map(c =>
                c.clubId.toString() === clubId
                    ? { ...c.toObject(), role: "CLUB_ADMIN" }
                    : c
            );
        }

        user.role = USER_TYPE.CLUB_ADMIN;

        await user.save({ session });

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            success: true,
            message: "Club admin assigned successfully",
            data: {
                club: {
                    id: club._id,
                    name: club.name
                },
                admin: {
                    id: user._id,
                    name: user.fullName,
                    email: user.email
                }
            }
        });

    } catch (error) {

        await session.abortTransaction();
        session.endSession();

        console.error("Assign Club Admin Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while assigning club admin"
        });
    }
};

const joinClub = async (req, res) => {
    try {
        const { clubCode } = req.params;
        const userId = req.user.id;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (!user.college?.collegeId) {
            return res.status(403).json({
                success: false,
                message: "User is not assigned to any college"
            });
        }

        const club = await Club.findOneAndUpdate(
            {
                code: clubCode,
                status: "ACTIVE",
                "college.collegeId": user.college.collegeId,
                members: { $ne: userId }
            },
            {
                $addToSet: { members: userId },
                $inc: { "stats.activeMembers": 1 }
            },
            { new: true }
        );

        if (!club) {
            const existingClub = await Club.findOne({ code: clubCode });

            if (!existingClub) {
                return res.status(404).json({
                    success: false,
                    message: "Club not found"
                });
            }

            if (existingClub.status !== "ACTIVE") {
                return res.status(400).json({
                    success: false,
                    message: "Club is not active"
                });
            }

            if (
                existingClub.college?.collegeId.toString() !==
                user.college.collegeId.toString()
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You can only join clubs from your college"
                });
            }

            return res.status(409).json({
                success: false,
                message: "Already a club member"
            });
        }

        await User.updateOne(
            {
                _id: userId,
                "clubs.clubId": { $ne: club._id }
            },
            {
                $addToSet: {
                    clubs: {
                        clubId: club._id,
                        role: "MEMBER"
                    }
                }
            }
        );

        return res.status(200).json({
            success: true,
            message: `Successfully joined ${club.name}`
        });

    } catch (error) {

        console.error("Join Club Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

module.exports = { getAllClubs, getClubsByCollege, getClubByCode, assignClubAdmin, getClubMembers, joinClub }