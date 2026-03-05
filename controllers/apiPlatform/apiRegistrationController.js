const ApiEvent = require("../../models/api/ApiEvent");
const ApiEventForm = require("../../models/api/ApiEventForm");
const ApiEventRegistration = require("../../models/api/ApiEventRegistration");
const EventPlatformUser = require("../../models/api/EventPlatformUser");
const sendEmail = require("../../utils/sendEmail");

const registerForEvent = async (req, res) => {
    try {
        const { eventId } = req.params;
        const apiContext = req.apiContext;

        const event = await ApiEvent.findById(eventId).populate("form");

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        if (event.status !== "PUBLISHED") {
            return res.status(400).json({
                success: false,
                message: "Event is not accepting registrations"
            });
        }

        if (!event.registration.isOpen) {
            return res.status(400).json({
                success: false,
                message: "Registration is closed for this event"
            });
        }

        if (
            event.registration.lastDate &&
            new Date() > new Date(event.registration.lastDate)
        ) {
            return res.status(400).json({
                success: false,
                message: "Registration deadline has passed"
            });
        }

        if (
            event.registration.limit &&
            event.participantsCount >= event.registration.limit
        ) {
            return res.status(400).json({
                success: false,
                message: "Event has reached maximum registration limit"
            });
        }

        const {
            registrantName,
            registrantEmail,
            registrantPhone,
            formData,
            teamName,
            teamMembers
        } = req.body;

        if (!registrantName || !registrantEmail) {
            return res.status(400).json({
                success: false,
                message: "Registrant name and email are required"
            });
        }

        const existing = await ApiEventRegistration.findOne({
            event: eventId,
            registrantEmail: registrantEmail.toLowerCase().trim()
        });

        if (existing) {
            return res.status(409).json({
                success: false,
                message: "This email is already registered for this event"
            });
        }

        if (event.form && event.form.fields) {
            const requiredFields = event.form.fields.filter((f) => f.required);
            for (const field of requiredFields) {
                if (!formData || formData[field.name] === undefined || formData[field.name] === "") {
                    return res.status(400).json({
                        success: false,
                        message: `Required field "${field.label}" is missing`
                    });
                }
            }
        }

        const registration = new ApiEventRegistration({
            event: eventId,
            platformUser: event.platformUser,
            registrantName,
            registrantEmail: registrantEmail.toLowerCase().trim(),
            registrantPhone: registrantPhone || null,
            formData: formData || {},
            teamName: teamName || null,
            teamMembers: teamMembers || [],
            payment: {
                status: event.registration.fee > 0 ? "PENDING" : "FREE",
                amount: event.registration.fee || 0
            },
            ipAddress:
                req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
                req.connection?.remoteAddress ||
                req.ip,
            userAgent: req.headers["user-agent"] || null
        });

        await registration.save();

        await ApiEvent.findByIdAndUpdate(eventId, {
            $inc: { participantsCount: 1 }
        });

        const platformUser = await EventPlatformUser.findById(event.platformUser);
        if (platformUser?.settings?.notifyOnRegistration) {
            sendEmail({
                to: platformUser.email,
                subject: `New Registration: ${event.title}`,
                template: "welcome",
                data: {
                    fullName: platformUser.fullName,
                    email: registrantEmail,
                    dashboardUrl: process.env.PLATFORM_DASHBOARD_URL || "",
                    contactEmail: process.env.EMAIL_FROM || ""
                }
            }).catch(() => {});
        }

        return res.status(201).json({
            success: true,
            message: "Registration successful",
            data: {
                registrationId: registration._id,
                event: event.title,
                registrant: registrantName
            }
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "This email is already registered for this event"
            });
        }
        return res.status(500).json({
            success: false,
            message: "Registration failed",
            error: err.message
        });
    }
};

const getRegistrations = async (req, res) => {
    try {
        const { eventId } = req.params;
        const platformUserId = req.platformUser.id;
        const {
            page = 1,
            limit = 20,
            status,
            search,
            sortBy = "createdAt",
            sortOrder = "desc"
        } = req.query;

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

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

        const filter = { event: eventId };
        if (status) filter.status = status;
        if (search) {
            filter.$or = [
                { registrantName: { $regex: search, $options: "i" } },
                { registrantEmail: { $regex: search, $options: "i" } }
            ];
        }

        const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

        const [registrations, total] = await Promise.all([
            ApiEventRegistration.find(filter)
                .sort(sort)
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .lean(),
            ApiEventRegistration.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            data: {
                registrations,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum)
                }
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch registrations",
            error: err.message
        });
    }
};

const getRegistration = async (req, res) => {
    try {
        const { eventId, regId } = req.params;
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

        const registration = await ApiEventRegistration.findOne({
            _id: regId,
            event: eventId
        }).populate("performance.judgeScores.judge", "name email role");

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: "Registration not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: registration
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch registration",
            error: err.message
        });
    }
};

const markAttendance = async (req, res) => {
    try {
        const { eventId, regId } = req.params;
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

        const registration = await ApiEventRegistration.findOne({
            _id: regId,
            event: eventId
        });

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: "Registration not found"
            });
        }

        registration.attendance.marked = true;
        registration.attendance.markedAt = new Date();
        await registration.save();

        return res.status(200).json({
            success: true,
            message: "Attendance marked successfully"
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to mark attendance",
            error: err.message
        });
    }
};

module.exports = {
    registerForEvent,
    getRegistrations,
    getRegistration,
    markAttendance
};
