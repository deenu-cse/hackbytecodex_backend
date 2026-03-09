const mongoose = require("mongoose");
const College = require("../../models/college");
const Club = require("../../models/club");
const User = require("../../models/user");
const Event = require("../../models/event");
const EventRegistration = require("../../models/eventRegistration");
const Project = require("../../models/project");
const { USER_TYPE } = require("../../constants/allConstant");

// ===== SUPER ADMIN DASHBOARD =====
const getSuperAdminDashboard = async (req, res) => {
    try {
        const [
            totalColleges,
            activeColleges,
            totalClubs,
            totalUsers,
            totalEvents,
            totalStudents,
            recentColleges,
            topPerformers
        ] = await Promise.all([
            College.countDocuments(),
            College.countDocuments({ status: "ACTIVE" }),
            Club.countDocuments(),
            User.countDocuments(),
            Event.countDocuments(),
            User.countDocuments({ role: USER_TYPE.STUDENT }),
            College.find().sort({ createdAt: -1 }).limit(5).select("name code logo stats performance"),
            College.find().sort({ "performance.score": -1 }).limit(5).select("name code performance")
        ]);

        // Get events by status
        const eventsByStatus = await Event.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);

        // Get user distribution by role
        const usersByRole = await User.aggregate([
            { $group: { _id: "$role", count: { $sum: 1 } } }
        ]);

        // Recent activity
        const recentEvents = await Event.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select("title slug banners startDate eventType participantsCount");

        return res.status(200).json({
            success: true,
            data: {
                overview: {
                    totalColleges,
                    activeColleges,
                    totalClubs,
                    totalUsers,
                    totalEvents,
                    totalStudents
                },
                eventsByStatus,
                usersByRole,
                recentColleges,
                recentEvents,
                topPerformers
            }
        });

    } catch (error) {
        console.error("Super Admin Dashboard Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching dashboard data",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// ===== COLLEGE LEAD DASHBOARD =====
const getCollegeLeadDashboard = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);

        if (!user?.college?.collegeId) {
            return res.status(404).json({
                success: false,
                message: "College not found"
            });
        }

        const collegeId = user.college.collegeId;

        const [
            college,
            totalClubs,
            totalEvents,
            totalStudents,
            totalRegistrations,
            upcomingEvents,
            recentRegistrations
        ] = await Promise.all([
            College.findById(collegeId).select("name code logo stats performance rewards"),
            Club.countDocuments({ "college.collegeId": collegeId }),
            Event.countDocuments({ "college.collegeId": collegeId }),
            User.countDocuments({ "college.collegeId": collegeId }),
            EventRegistration.countDocuments({ college: collegeId }),
            Event.find({ 
                "college.collegeId": collegeId,
                startDate: { $gte: new Date() },
                status: "PUBLISHED"
            })
                .sort({ startDate: 1 })
                .limit(5)
                .select("title slug startDate endDate eventType"),
            EventRegistration.find({ college: collegeId })
                .sort({ createdAt: -1 })
                .limit(5)
                .populate("user", "fullName email avatar")
                .populate("event", "title slug")
        ]);

        // Club distribution
        const clubsByTier = await Club.aggregate([
            { $match: { "college.collegeId": new mongoose.Types.ObjectId(collegeId) } },
            { $group: { _id: "$performance.tier", count: { $sum: 1 } } }
        ]);

        // Events by type
        const eventsByType = await Event.aggregate([
            { $match: { "college.collegeId": new mongoose.Types.ObjectId(collegeId) } },
            { $group: { _id: "$eventType", count: { $sum: 1 } } }
        ]);

        // Student activity trend (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const studentRegistrations = await EventRegistration.aggregate([
            {
                $match: {
                    college: new mongoose.Types.ObjectId(collegeId),
                    createdAt: { $gte: thirtyDaysAgo }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        return res.status(200).json({
            success: true,
            data: {
                college,
                overview: {
                    totalClubs,
                    totalEvents,
                    totalStudents,
                    totalRegistrations
                },
                upcomingEvents,
                recentRegistrations,
                clubsByTier,
                eventsByType,
                studentActivityTrend: studentRegistrations
            }
        });

    } catch (error) {
        console.error("College Lead Dashboard Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching dashboard data",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// ===== CLUB ADMIN DASHBOARD =====
const getClubAdminDashboard = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);

        if (!user?.college?.collegeId) {
            return res.status(404).json({
                success: false,
                message: "College not found"
            });
        }

        // Find clubs where user is admin
        const adminClubs = await Club.find({ admins: userId })
            .populate("college.collegeId", "name code");

        if (!adminClubs || adminClubs.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No clubs found where you are an admin"
            });
        }

        const clubIds = adminClubs.map(club => club._id);

        const [
            totalMembers,
            totalEvents,
            upcomingEvents,
            recentActivities
        ] = await Promise.all([
            Club.aggregate([
                { $match: { _id: { $in: clubIds } } },
                { $group: { _id: null, total: { $sum: { $size: "$members" } } } }
            ]),
            Event.countDocuments({ "club.clubId": { $in: clubIds } }),
            Event.find({ 
                "club.clubId": { $in: clubIds },
                startDate: { $gte: new Date() },
                status: "PUBLISHED"
            })
                .sort({ startDate: 1 })
                .limit(5)
                .select("title slug startDate endDate eventType"),
            EventRegistration.find({ club: { $in: clubIds } })
                .sort({ createdAt: -1 })
                .limit(10)
                .populate("user", "fullName email")
                .populate("event", "title slug")
        ]);

        // Events by status for this club
        const eventsByStatus = await Event.aggregate([
            { $match: { "club.clubId": { $in: clubIds } } },
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);

        return res.status(200).json({
            success: true,
            data: {
                adminClubs,
                overview: {
                    totalMembers: totalMembers[0]?.total || 0,
                    totalEvents,
                    upcomingEventsCount: upcomingEvents.length
                },
                upcomingEvents,
                recentActivities,
                eventsByStatus
            }
        });

    } catch (error) {
        console.error("Club Admin Dashboard Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching dashboard data",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// ===== STUDENT DASHBOARD =====
const getStudentDashboard = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId)
            .populate("college.collegeId", "name code logo");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Get registered events
        const registeredEvents = await EventRegistration.find({ user: userId })
            .populate("event", "title slug startDate endDate eventType banners location mode");

        // Get upcoming events from user's college
        const upcomingCollegeEvents = await Event.find({
            "college.collegeId": user.college?.collegeId,
            startDate: { $gte: new Date() },
            status: "PUBLISHED"
        })
            .sort({ startDate: 1 })
            .limit(10)
            .select("title slug description startDate endDate eventType banners location mode registration");

        // Get all upcoming events (global)
        const upcomingGlobalEvents = await Event.find({
            startDate: { $gte: new Date() },
            status: "PUBLISHED"
        })
            .sort({ startDate: 1 })
            .limit(10)
            .select("title slug description startDate endDate eventType banners location mode registration");

        // User's participation stats
        const totalParticipated = registeredEvents.length;
        const attendedCount = registeredEvents.filter(r => r.attendance === true).length;

        return res.status(200).json({
            success: true,
            data: {
                user: {
                    name: user.fullName,
                    email: user.email,
                    avatar: user.avatar,
                    college: user.college,
                    role: user.role,
                    performance: user.performance
                },
                stats: {
                    totalParticipated,
                    attendedCount,
                    upcomingCount: upcomingCollegeEvents.length
                },
                registeredEvents,
                upcomingCollegeEvents,
                upcomingGlobalEvents
            }
        });

    } catch (error) {
        console.error("Student Dashboard Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching dashboard data",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

module.exports = {
    getSuperAdminDashboard,
    getCollegeLeadDashboard,
    getClubAdminDashboard,
    getStudentDashboard
};
