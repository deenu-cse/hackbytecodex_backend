const mongoose = require("mongoose");
const ApiEvent = require("../../models/api/ApiEvent");
const Subscription = require("../../models/api/Subscription");

const createEvent = async (req, res) => {
    try {
        const platformUserId = req.platformUser.id;
        const {
            title,
            description,
            eventType,
            mode,
            startDate,
            endDate,
            location,
            registration,
            scoring,
            isPublic
        } = req.body;

        if (!title || !eventType) {
            return res.status(400).json({
                success: false,
                message: "Title and event type are required"
            });
        }

        const event = new ApiEvent({
            platformUser: platformUserId,
            title,
            description: description || "",
            eventType,
            mode: mode || "ONLINE",
            startDate: startDate || null,
            endDate: endDate || null,
            location: location || {},
            registration: registration || {},
            scoring: scoring || { criteria: [], maxScore: 100 },
            isPublic: isPublic !== undefined ? isPublic : true
        });

        await event.save();

        await Subscription.findOneAndUpdate(
            { epuId: platformUserId, status: { $in: ["ACTIVE", "PAST_DUE"] } },
            { $inc: { "usage.eventsCreated": 1 } }
        );

        return res.status(201).json({
            success: true,
            message: "Event created successfully",
            data: event
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "An event with a similar name already exists. Try a different title."
            });
        }
        return res.status(500).json({
            success: false,
            message: "Failed to create event",
            error: err.message
        });
    }
};

const getEvents = async (req, res) => {
    try {
        const platformUserId = req.platformUser.id;
        const {
            page = 1,
            limit = 10,
            status,
            search,
            eventType,
            sortBy = "createdAt",
            sortOrder = "desc"
        } = req.query;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit)));

        const filter = { platformUser: platformUserId };

        if (status) filter.status = status;
        if (eventType) filter.eventType = eventType;
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } }
            ];
        }

        const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

        const [events, total] = await Promise.all([
            ApiEvent.find(filter)
                .sort(sort)
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .lean(),
            ApiEvent.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            data: {
                events,
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
            message: "Failed to fetch events",
            error: err.message
        });
    }
};

const getEvent = async (req, res) => {
    try {
        const { eventId } = req.params;
        const platformUserId = req.platformUser.id;

        const event = await ApiEvent.findOne({
            _id: eventId,
            platformUser: platformUserId
        })
            .populate("form")
            .populate("judges", "name email role status");

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: event
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch event",
            error: err.message
        });
    }
};

const updateEvent = async (req, res) => {
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

        const allowedFields = [
            "title", "description", "eventType", "mode",
            "startDate", "endDate", "location", "registration",
            "scoring", "isPublic", "banners"
        ];

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                event[field] = req.body[field];
            }
        }

        await event.save();

        return res.status(200).json({
            success: true,
            message: "Event updated successfully",
            data: event
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to update event",
            error: err.message
        });
    }
};

const deleteEvent = async (req, res) => {
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

        if (event.participantsCount > 0 && event.status !== "DRAFT") {
            return res.status(400).json({
                success: false,
                message: "Cannot delete an event with active registrations. Cancel it instead."
            });
        }

        event.status = "CANCELLED";
        await event.save();

        return res.status(200).json({
            success: true,
            message: "Event cancelled successfully"
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to delete event",
            error: err.message
        });
    }
};

const publishEvent = async (req, res) => {
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

        if (event.status !== "DRAFT") {
            return res.status(400).json({
                success: false,
                message: `Cannot publish event with status: ${event.status}`
            });
        }

        if (!event.title || !event.eventType) {
            return res.status(400).json({
                success: false,
                message: "Event must have a title and event type before publishing"
            });
        }

        event.status = "PUBLISHED";
        await event.save();

        return res.status(200).json({
            success: true,
            message: "Event published successfully",
            data: event
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to publish event",
            error: err.message
        });
    }
};

module.exports = {
    createEvent,
    getEvents,
    getEvent,
    updateEvent,
    deleteEvent,
    publishEvent
};
