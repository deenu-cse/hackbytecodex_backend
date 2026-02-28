const College = require("../../../models/college");
const Club = require("../../../models/club");
const User = require("../../../models/user");
const Event = require("../../../models/event");
const Project = require("../../../models/project");
const mongoose = require("mongoose");


const getAllColleges = async (req, res) => {
    try {
        let {
            page = 1,
            limit = 12,
            search,
            city,
            state,
            country = "India",
            tier,
            minScore,
            maxScore,
            minRating,
            status = "ACTIVE",
            hasClubs,
            isVerified,
            sortBy = "performance.score",
            sortOrder = "desc",
            fields
        } = req.query;

        // Parse pagination
        page = Math.max(1, parseInt(page));
        limit = Math.min(50, Math.max(1, parseInt(limit)));
        const skip = (page - 1) * limit;

        // Build match stage
        let match = {};

        // Status filter (default to ACTIVE for public view)
        if (status) {
            match.status = status;
        }

        // Verification filter
        if (isVerified !== undefined) {
            match.isVerified = isVerified === "true";
        }

        // Text search on name, code, city, state
        if (search?.trim()) {
            match.$text = { $search: search.trim() };
        }

        // Location filters
        if (city) {
            match["address.city"] = { $regex: city, $options: "i" };
        }
        if (state) {
            match["address.state"] = { $regex: state, $options: "i" };
        }
        if (country) {
            match["address.country"] = { $regex: country, $options: "i" };
        }

        // Performance filters
        if (tier) {
            match["performance.tier"] = tier.toUpperCase();
        }
        if (minScore !== undefined || maxScore !== undefined) {
            match["performance.score"] = {};
            if (minScore !== undefined) match["performance.score"].$gte = parseFloat(minScore);
            if (maxScore !== undefined) match["performance.score"].$lte = parseFloat(maxScore);
        }
        if (minRating !== undefined) {
            match["performance.rating"] = { $gte: parseFloat(minRating) };
        }

        // Build sort stage
        let sort = {};
        const order = sortOrder === "asc" ? 1 : -1;

        switch (sortBy) {
            case "name":
                sort.name = order;
                break;
            case "rating":
                sort["performance.rating"] = order;
                break;
            case "score":
                sort["performance.score"] = order;
                break;
            case "eventsHosted":
                sort["stats.eventsHosted"] = order;
                break;
            case "clubsCount":
                sort["stats.clubsCount"] = order;
                break;
            case "createdAt":
                sort.createdAt = order;
                break;
            default:
                sort["performance.score"] = -1;
        }

        // Add secondary sort by name for consistency
        if (sortBy !== "name") {
            sort.name = 1;
        }

        // Build projection
        let projection = {
            name: 1,
            code: 1,
            logo: 1,
            banners: 1,
            address: 1,
            website: 1,
            performance: 1,
            stats: 1,
            isVerified: 1,
            status: 1,
            createdAt: 1,
            updatedAt: 1
        };

        // Custom field selection
        if (fields) {
            const selectedFields = fields.split(",").reduce((acc, field) => {
                acc[field.trim()] = 1;
                return acc;
            }, {});
            projection = { ...projection, ...selectedFields };
        }

        // Execute aggregation
        const colleges = await College.aggregate([
            { $match: match },
            { $sort: sort },
            {
                $facet: {
                    data: [
                        { $skip: skip },
                        { $limit: limit },
                        { $project: projection }
                    ],
                    totalCount: [{ $count: "count" }],
                    // Get unique cities for filter options
                    cities: [
                        { $group: { _id: "$address.city", count: { $sum: 1 } } },
                        { $match: { _id: { $ne: null } } },
                        { $sort: { count: -1 } },
                        { $limit: 20 }
                    ],
                    // Get unique states for filter options
                    states: [
                        { $group: { _id: "$address.state", count: { $sum: 1 } } },
                        { $match: { _id: { $ne: null } } },
                        { $sort: { count: -1 } },
                        { $limit: 20 }
                    ],
                    // Tier distribution
                    tiers: [
                        { $group: { _id: "$performance.tier", count: { $sum: 1 } } }
                    ]
                }
            }
        ]);

        const result = colleges[0];
        const total = result.totalCount[0]?.count || 0;

        // Format filter options
        const filters = {
            cities: result.cities.map(c => ({ name: c._id, count: c.count })),
            states: result.states.map(s => ({ name: s._id, count: s.count })),
            tiers: result.tiers.map(t => ({ name: t._id, count: t.count }))
        };

        return res.status(200).json({
            success: true,
            message: "Colleges fetched successfully",
            meta: {
                pagination: {
                    total,
                    page,
                    pages: Math.ceil(total / limit),
                    limit,
                    hasNextPage: page < Math.ceil(total / limit),
                    hasPrevPage: page > 1
                },
                filters,
                appliedFilters: {
                    search: search || null,
                    city: city || null,
                    state: state || null,
                    tier: tier || null,
                    sortBy,
                    sortOrder
                }
            },
            data: result.data
        });

    } catch (error) {
        console.error("Get All Colleges Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching colleges",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

const getCollegeById = async (req, res) => {
    try {
        const { collegeId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(collegeId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid college ID format"
            });
        }

        const college = await College.aggregate([
            { $match: { _id: new mongoose.Types.ObjectId(collegeId) } },
            { $limit: 1 },
            {
                $lookup: {
                    from: "clubs",
                    localField: "clubs",
                    foreignField: "_id",
                    pipeline: [
                        { $match: { status: "ACTIVE" } },
                        {
                            $project: {
                                name: 1,
                                code: 1,
                                logo: 1,
                                description: 1,
                                performance: 1,
                                stats: 1,
                                createdAt: 1
                            }
                        }
                    ],
                    as: "clubsData"
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "collegeLead",
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
                    as: "collegeLeadData"
                }
            },
            {
                $lookup: {
                    from: "events",
                    localField: "_id",
                    foreignField: "college.collegeId",
                    pipeline: [
                        { $sort: { startDate: -1 } },
                        { $limit: 5 },
                        {
                            $project: {
                                title: 1,
                                slug: 1,
                                banners: 1,
                                startDate: 1,
                                endDate: 1,
                                eventType: 1,
                                participantsCount: 1,
                                status: 1,
                                mode: 1
                            }
                        }
                    ],
                    as: "recentEvents"
                }
            },
            {
                $addFields: {
                    clubsCount: { $size: "$clubsData" },
                    totalMembers: { $sum: "$clubsData.stats.activeMembers" }
                }
            },
            {
                $project: {
                    name: 1,
                    code: 1,
                    email: 1,
                    phone: 1,
                    website: 1,
                    address: 1,
                    logo: 1,
                    banners: 1,
                    performance: 1,
                    stats: 1,
                    rewards: 1,
                    isVerified: 1,
                    status: 1,
                    createdAt: 1,
                    clubsCount: 1,
                    totalMembers: 1,
                    clubs: "$clubsData",
                    collegeLead: { $arrayElemAt: ["$collegeLeadData", 0] },
                    recentEvents: 1
                }
            }
        ]);

        if (!college.length) {
            return res.status(404).json({
                success: false,
                message: "College not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "College fetched successfully",
            data: college[0]
        });

    } catch (error) {
        console.error("Get College By ID Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching college",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

const getCollegeByName = async (req, res) => {
    try {
        const { collegeName } = req.params;
        const decodedName = decodeURIComponent(collegeName).trim();

        let college = await College.aggregate([
            {
                $match: {
                    $or: [
                        { name: decodedName },
                        { name: { $regex: `^${decodedName}$`, $options: "i" } },
                        { code: { $regex: `^${decodedName}$`, $options: "i" } }
                    ],
                    status: "ACTIVE"
                }
            },
            { $limit: 1 },
            {
                $lookup: {
                    from: "clubs",
                    localField: "clubs",
                    foreignField: "_id",
                    pipeline: [
                        { $match: { status: "ACTIVE" } },
                        {
                            $addFields: {
                                membersCount: { $size: "$members" },
                                eventsCount: { $size: "$events" }
                            }
                        },
                        {
                            $project: {
                                name: 1,
                                code: 1,
                                logo: 1,
                                description: 1,
                                performance: 1,
                                stats: 1,
                                membersCount: 1,
                                eventsCount: 1,
                                createdAt: 1
                            }
                        }
                    ],
                    as: "clubsData"
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "collegeLead",
                    foreignField: "_id",
                    pipeline: [
                        {
                            $project: {
                                fullName: 1,
                                email: 1,
                                avatar: 1,
                                role: 1,
                                "performance.badges": 1
                            }
                        }
                    ],
                    as: "collegeLeadData"
                }
            },
            {
                $lookup: {
                    from: "events",
                    localField: "_id",
                    foreignField: "college.collegeId",
                    pipeline: [
                        { $sort: { startDate: -1 } },
                        { $limit: 10 },
                        {
                            $project: {
                                title: 1,
                                slug: 1,
                                description: 1,
                                banners: 1,
                                startDate: 1,
                                endDate: 1,
                                eventType: 1,
                                participantsCount: 1,
                                status: 1,
                                mode: 1,
                                "registration.fee": 1
                            }
                        }
                    ],
                    as: "recentEvents"
                }
            },
            {
                $lookup: {
                    from: "projects",
                    let: { collegeId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$college.collegeId", "$$collegeId"] },
                                status: "PUBLISHED"
                            }
                        },
                        { $sort: { createdAt: -1 } },
                        { $limit: 6 },
                        {
                            $project: {
                                title: 1,
                                slug: 1,
                                shortDescription: 1,
                                coverImage: 1,
                                techStack: 1,
                                likeCount: 1,
                                viewCount: 1,
                                createdAt: 1
                            }
                        }
                    ],
                    as: "featuredProjects"
                }
            },
            {
                $addFields: {
                    clubsCount: { $size: "$clubsData" },
                    totalMembers: { $sum: "$clubsData.members" }
                }
            },
            {
                $project: {
                    name: 1,
                    code: 1,
                    email: 1,
                    phone: 1,
                    website: 1,
                    address: 1,
                    logo: 1,
                    banners: 1,
                    performance: 1,
                    stats: 1,
                    rewards: 1,
                    isVerified: 1,
                    status: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    clubsCount: 1,
                    totalMembers: 1,
                    clubs: "$clubsData",
                    collegeLead: { $arrayElemAt: ["$collegeLeadData", 0] },
                    recentEvents: 1,
                    featuredProjects: 1
                }
            }
        ]);

        // If no exact match, try partial match
        if (!college.length) {
            college = await College.aggregate([
                {
                    $match: {
                        name: { $regex: decodedName, $options: "i" },
                        status: "ACTIVE"
                    }
                },
                { $limit: 1 },
                {
                    $lookup: {
                        from: "clubs",
                        localField: "clubs",
                        foreignField: "_id",
                        pipeline: [
                            { $match: { status: "ACTIVE" } },
                            {
                                $addFields: {
                                    membersCount: { $size: "$members" },
                                    eventsCount: { $size: "$events" }
                                }
                            },
                            {
                                $project: {
                                    name: 1,
                                    code: 1,
                                    logo: 1,
                                    description: 1,
                                    performance: 1,
                                    stats: 1,
                                    membersCount: 1,
                                    eventsCount: 1,
                                    createdAt: 1
                                }
                            }
                        ],
                        as: "clubsData"
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "collegeLead",
                        foreignField: "_id",
                        pipeline: [
                            {
                                $project: {
                                    fullName: 1,
                                    email: 1,
                                    avatar: 1,
                                    role: 1,
                                    "performance.badges": 1
                                }
                            }
                        ],
                        as: "collegeLeadData"
                    }
                },
                {
                    $lookup: {
                        from: "events",
                        localField: "_id",
                        foreignField: "college.collegeId",
                        pipeline: [
                            { $sort: { startDate: -1 } },
                            { $limit: 10 },
                            {
                                $project: {
                                    title: 1,
                                    slug: 1,
                                    description: 1,
                                    banners: 1,
                                    startDate: 1,
                                    endDate: 1,
                                    eventType: 1,
                                    participantsCount: 1,
                                    status: 1,
                                    mode: 1,
                                    "registration.fee": 1
                                }
                            }
                        ],
                        as: "recentEvents"
                    }
                },
                {
                    $lookup: {
                        from: "projects",
                        let: { collegeId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ["$college.collegeId", "$$collegeId"] },
                                    status: "PUBLISHED"
                                }
                            },
                            { $sort: { createdAt: -1 } },
                            { $limit: 6 },
                            {
                                $project: {
                                    title: 1,
                                    slug: 1,
                                    shortDescription: 1,
                                    coverImage: 1,
                                    techStack: 1,
                                    likeCount: 1,
                                    viewCount: 1,
                                    createdAt: 1
                                }
                            }
                        ],
                        as: "featuredProjects"
                    }
                },
                {
                    $addFields: {
                        clubsCount: { $size: "$clubsData" },
                        totalMembers: { $sum: "$clubsData.members" }
                    }
                },
                {
                    $project: {
                        name: 1,
                        code: 1,
                        email: 1,
                        phone: 1,
                        website: 1,
                        address: 1,
                        logo: 1,
                        banners: 1,
                        performance: 1,
                        stats: 1,
                        rewards: 1,
                        isVerified: 1,
                        status: 1,
                        createdAt: 1,
                        updatedAt: 1,
                        clubsCount: 1,
                        totalMembers: 1,
                        clubs: "$clubsData",
                        collegeLead: { $arrayElemAt: ["$collegeLeadData", 0] },
                        recentEvents: 1,
                        featuredProjects: 1
                    }
                }
            ]);
        }

        if (!college.length) {
            return res.status(404).json({
                success: false,
                message: "College not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "College fetched successfully",
            data: college[0]
        });

    } catch (error) {
        console.error("Get College By Name Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching college",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

const getClubsByCollegeName = async (req, res) => {
    try {
        const { collegeName } = req.params;
        const decodedName = decodeURIComponent(collegeName).trim();

        let {
            page = 1,
            limit = 10,
            tier,
            minScore,
            minRating,
            sortBy = "performance.score",
            sortOrder = "desc"
        } = req.query;

        page = Math.max(1, parseInt(page));
        limit = Math.min(50, Math.max(1, parseInt(limit)));
        const skip = (page - 1) * limit;

        // Find college first
        const college = await College.findOne({
            $or: [
                { name: decodedName },
                { name: { $regex: `^${decodedName}$`, $options: "i" } },
                { code: { $regex: `^${decodedName}$`, $options: "i" } }
            ],
            status: "ACTIVE"
        }).select("_id name");

        if (!college) {
            return res.status(404).json({
                success: false,
                message: "College not found"
            });
        }

        // Build match for clubs
        let match = {
            "college.collegeId": college._id,
            status: "ACTIVE"
        };

        if (tier) {
            match["performance.tier"] = tier.toUpperCase();
        }
        if (minScore) {
            match["performance.score"] = { $gte: parseFloat(minScore) };
        }
        if (minRating) {
            match["performance.rating"] = { $gte: parseFloat(minRating) };
        }

        // Build sort
        let sort = {};
        const order = sortOrder === "asc" ? 1 : -1;

        switch (sortBy) {
            case "name":
                sort.name = order;
                break;
            case "rating":
                sort["performance.rating"] = order;
                break;
            case "score":
                sort["performance.score"] = order;
                break;
            case "members":
                sort = { membersCount: order };
                break;
            case "events":
                sort["stats.eventsHosted"] = order;
                break;
            case "createdAt":
                sort.createdAt = order;
                break;
            default:
                sort["performance.score"] = -1;
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
                                performance: 1,
                                stats: 1,
                                membersCount: 1,
                                adminsCount: 1,
                                eventsCount: 1,
                                createdAt: 1
                            }
                        }
                    ],
                    totalCount: [{ $count: "count" }]
                }
            }
        ]);

        const total = clubs[0].totalCount[0]?.count || 0;

        return res.status(200).json({
            success: true,
            message: "Clubs fetched successfully",
            meta: {
                pagination: {
                    total,
                    page,
                    pages: Math.ceil(total / limit),
                    limit,
                    hasNextPage: page < Math.ceil(total / limit),
                    hasPrevPage: page > 1
                },
                college: {
                    id: college._id,
                    name: college.name
                }
            },
            data: clubs[0].data
        });

    } catch (error) {
        console.error("Get Clubs By College Name Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching clubs",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};


const getCollegeLeaderboard = async (req, res) => {
    try {
        let { limit = 10, tier } = req.query;
        limit = Math.min(100, Math.max(1, parseInt(limit)));

        let match = { status: "ACTIVE" };
        if (tier) {
            match["performance.tier"] = tier.toUpperCase();
        }

        const colleges = await College.aggregate([
            { $match: match },
            {
                $addFields: {
                    clubsCount: { $size: "$clubs" }
                }
            },
            { $sort: { "performance.score": -1 } },
            {
                $project: {
                    name: 1,
                    code: 1,
                    logo: 1,
                    address: { city: 1, state: 1 },
                    performance: 1,
                    stats: 1,
                    clubsCount: 1,
                    isVerified: 1
                }
            },
            { $limit: limit }
        ]);

        // Add rank to each college
        const rankedColleges = colleges.map((college, index) => ({
            ...college,
            rank: index + 1
        }));

        return res.status(200).json({
            success: true,
            message: "Leaderboard fetched successfully",
            data: rankedColleges
        });

    } catch (error) {
        console.error("Get College Leaderboard Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching leaderboard",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

const getCollegeFilterOptions = async (req, res) => {
    try {
        const [cities, states, tiers] = await Promise.all([
            College.distinct("address.city", { status: "ACTIVE", "address.city": { $ne: null } }),
            College.distinct("address.state", { status: "ACTIVE", "address.state": { $ne: null } }),
            College.distinct("performance.tier", { status: "ACTIVE" })
        ]);

        return res.status(200).json({
            success: true,
            message: "Filter options fetched successfully",
            data: {
                cities: cities.filter(Boolean).sort(),
                states: states.filter(Boolean).sort(),
                tiers: tiers.filter(Boolean).sort()
            }
        });

    } catch (error) {
        console.error("Get College Filter Options Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching filter options",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

const getClubDetailByCollege = async (req, res) => {
    try {
        const { collegeName, clubCode } = req.params;
        const decodedCollegeName = decodeURIComponent(collegeName).trim();

        // Find college
        const college = await College.findOne({
            $or: [
                { name: decodedCollegeName },
                { name: { $regex: `^${decodedCollegeName}$`, $options: "i" } },
                { code: { $regex: `^${decodedCollegeName}$`, $options: "i" } }
            ],
            status: "ACTIVE"
        }).select("_id name code logo address");

        if (!college) {
            return res.status(404).json({
                success: false,
                message: "College not found"
            });
        }

        // Get club with full details
        const club = await Club.aggregate([
            {
                $match: {
                    code: clubCode.toUpperCase(),
                    "college.collegeId": college._id,
                    status: "ACTIVE"
                }
            },
            { $limit: 1 },
            {
                $addFields: {
                    membersCount: { $size: "$members" },
                    adminsCount: { $size: "$admins" },
                    eventsCount: { $size: "$events" }
                }
            },
            // Lookup admins with user details
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
                                role: 1,
                                "performance.badges": 1,
                                "performance.rating": 1
                            }
                        }
                    ],
                    as: "adminsData"
                }
            },
            // Lookup top members
            {
                $lookup: {
                    from: "users",
                    localField: "members",
                    foreignField: "_id",
                    pipeline: [
                        {
                            $project: {
                                fullName: 1,
                                avatar: 1,
                                role: 1,
                                "performance.badges": 1,
                                "performance.rating": 1,
                                "performance.score": 1
                            }
                        },
                        { $sort: { "performance.score": -1 } },
                        { $limit: 10 }
                    ],
                    as: "topMembers"
                }
            },
            // Lookup events
            {
                $lookup: {
                    from: "events",
                    localField: "events",
                    foreignField: "_id",
                    pipeline: [
                        { $sort: { startDate: -1 } },
                        {
                            $project: {
                                title: 1,
                                slug: 1,
                                description: 1,
                                banners: 1,
                                startDate: 1,
                                endDate: 1,
                                eventType: 1,
                                participantsCount: 1,
                                status: 1,
                                mode: 1
                            }
                        }
                    ],
                    as: "eventsData"
                }
            },
            // Calculate rank within college
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
                    banners: 1,
                    performance: 1,
                    stats: 1,
                    rewards: 1,
                    status: 1,
                    createdAt: 1,
                    membersCount: 1,
                    adminsCount: 1,
                    eventsCount: 1,
                    rankInCollege: 1,
                    college: {
                        _id: college._id,
                        name: college.name,
                        code: college.code,
                        logo: college.logo,
                        address: college.address
                    },
                    admins: "$adminsData",
                    topMembers: "$topMembers",
                    events: "$eventsData"
                }
            }
        ]);

        if (!club.length) {
            return res.status(404).json({
                success: false,
                message: "Club not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Club detail fetched successfully",
            data: club[0]
        });

    } catch (error) {
        console.error("Get Club Detail By College Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching club detail",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

module.exports = {
    getAllColleges,
    getCollegeById,
    getCollegeByName,
    getClubsByCollegeName,
    getCollegeLeaderboard,
    getCollegeFilterOptions,
    getClubDetailByCollege
};
