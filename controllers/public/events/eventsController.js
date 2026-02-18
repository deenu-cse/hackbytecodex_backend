const Event = require("../../../models/event");
const EventRegistration = require("../../../models/eventRegistration");
const Club = require("../../../models/club");
const College = require("../../../models/college");
const User = require("../../../models/user");
const { USER_TYPE, PERFORMANCE_RULES } = require("../../../constants/allConstant");
const EventForm = require("../../../models/eventForm");

const getAllEvents = async (req, res) => {
  try {

    let {
      page = 1,
      limit = 10,
      search,
      eventType,
      mode,
      status,
      collegeId,
      clubId,
      minFee,
      maxFee,
      isOpen,
      startDate,
      endDate,
      sortBy = "createdAt",
      order = "desc"
    } = req.query;

    page = Math.max(1, Number(page));
    limit = Math.min(50, Number(limit));

    const query = {};

    if (collegeId) {
      query["college.collegeId"] = collegeId;
    }

    if (clubId) {
      query["club.clubId"] = clubId;
    }

    if (search) {
      query.$text = { $search: search };
    }

    if (eventType) query.eventType = eventType;
    if (mode) query.mode = mode;
    if (status) query.status = status;

    if (minFee || maxFee) {
      query["registration.fee"] = {};

      if (minFee) query["registration.fee"].$gte = Number(minFee);
      if (maxFee) query["registration.fee"].$lte = Number(maxFee);
    }

    if (isOpen !== undefined) {
      query["registration.isOpen"] = isOpen === "true";
    }

    if (startDate || endDate) {
      query.startDate = {};

      if (startDate) query.startDate.$gte = new Date(startDate);
      if (endDate) query.startDate.$lte = new Date(endDate);
    }

    const sortOrder = order === "asc" ? 1 : -1;

    const sortOptions = search
      ? { score: { $meta: "textScore" } }
      : { [sortBy]: sortOrder };


    const events = await Event.find(query)
      .select("-registrations")
      .populate("createdBy", "fullName avatar")
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Event.countDocuments(query);


    return res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      results: events.length,
      data: events
    });

  } catch (error) {
    console.error("Get All Events Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching events",
      error: error.message
    });
  }
};

const getEventBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Event slug is required"
      });
    }

    const event = await Event.findOne({
      slug,
      status: "PUBLISHED"
    })
      .select("-registrations")
      .populate("createdBy", "fullName avatar")
      .lean();

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found or is not published"
      });
    }

    return res.status(200).json({
      success: true,
      data: event
    });

  } catch (error) {
    console.error("Get Event By Slug Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching event",
      error: error.message
    });
  }
};

const getEventForm = async (req, res) => {
    try {

        const { slug } = req.params;

        if (!slug) {
            return res.status(400).json({
                success: false,
                message: "Event slug is required"
            });
        }

        const event = await Event.findOne({ slug });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        const form = await EventForm.findOne({ event: event._id });

        if (!form) {
            return res.status(404).json({
                success: false,
                message: "Event form not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: form
        });

    } catch (err) {
        console.error("Get Event Form Error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching event form",
            error: err.message
        });
    }
};

const registerForEvent = async (req, res) => {
    try {

        const userId = req.user.id;
        const { slug } = req.params;
        const formData = { ...req.body };

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        if (!slug) {
            return res.status(400).json({
                success: false,
                message: "Event slug is required"
            });
        }

        if (req.files) {

            Object.keys(req.files).forEach(field => {

                const file = req.files[field][0];

                formData[field] = {
                    url: file.path,
                    public_id: file.filename
                };
            });
        }

        const event = await Event.findOne({ slug });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        if (!event.registration.isOpen) {
            return res.status(400).json({
                success: false,
                message: "Registrations for this event are currently closed"
            });
        }

        if (event.registration.limit &&
            event.participantsCount >= event.registration.limit) {
            return res.status(400).json({
                success: false,
                message: "Event has reached maximum participant capacity"
            });
        }

        const alreadyRegistered =
            await EventRegistration.findOne({
                event: event._id,
                user: userId
            });

        if (alreadyRegistered) {
            return res.status(409).json({
                success: false,
                message: "You are already registered for this event"
            });
        }

        const registration = await EventRegistration.create({

            event: event._id,
            user: userId,
            college: event.college?.collegeId,
            club: event.club?.clubId,

            formData,

            payment: {
                status:
                    event.registration.fee > 0
                        ? "PENDING"
                        : "FREE",
                amount: event.registration.fee
            }
        });

        await Event.findByIdAndUpdate(
            event._id,
            {
                $inc: { participantsCount: 1 },
                $push: { registrations: registration._id }
            }
        );

        await User.findByIdAndUpdate(userId, {
            $inc: { "activity.eventsParticipated": 1 }
        });

        return res.status(201).json({
            success: true,
            message: "Event registration successful",
            data: registration
        });

    } catch (err) {
        console.error("Register for Event Error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while registering for event",
            error: err.message
        });
    }
};

module.exports = { registerForEvent, getAllEvents, getEventBySlug, getEventForm, registerForEvent };