const Event = require("../../models/event");
const Club = require("../../models/club");
const College = require("../../models/college");
const User = require("../../models/user")
const { USER_TYPE, PERFORMANCE_RULES, getRewardTierByPoints } = require("../../constants/allConstant");
const cloudinary = require("../../middlewares/cloudinary/cloudinary");
const mongoose = require('mongoose')
const EventRegistration = require('../../models/eventRegistration')
const EventForm = require('../../models/eventForm');
const sendEmail = require("../../utils/sendEmail");
const jwt = require("jsonwebtoken");

const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {

  const R = 6371e3;

  const toRad = (deg) => deg * Math.PI / 180;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);

  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) *
    Math.cos(φ2) *
    Math.sin(Δλ / 2) *
    Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

const addEvent = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (user.role !== USER_TYPE.COLLEGE_LEAD) {
      return res.status(403).json({
        success: false,
        message: "Only College Lead can create events"
      });
    }

    const {
      collegeId,
      title,
      description,
      eventType,
      clubId,
      startDate,
      endDate,
      location,
      mode,
      registration,
      timeline
    } = req.body;

    if (!title || !eventType || !clubId) {
      return res.status(400).json({
        success: false,
        message: "Title, eventType and clubId are required"
      });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({
        success: false,
        message: "Club not found"
      });
    }

    if (club.college.collegeId.toString() !== collegeId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only create events for your own college clubs"
      });
    }

    const college = await College.findById(collegeId).select("name stats");

    let banners = [];

    if (req.files?.banners) {
      banners = req.files.banners.map(file => ({
        url: file.path,
        public_id: file.filename
      }));
    }

    const parsedRegistration =
      typeof registration === "string"
        ? JSON.parse(registration)
        : registration;

    const parsedTimeline =
      typeof timeline === "string"
        ? JSON.parse(timeline)
        : timeline;

    // Parse and validate location
    let parsedLocation;
    try {
      parsedLocation = typeof location === "string" ? JSON.parse(location) : location;

      // Validate location structure for non-online events
      if (mode !== "ONLINE") {
        if (!parsedLocation?.name?.trim()) {
          return res.status(400).json({
            success: false,
            message: "Location name is required for offline/hybrid events"
          });
        }

        if (!Array.isArray(parsedLocation.coordinates) ||
          parsedLocation.coordinates.length !== 2 ||
          typeof parsedLocation.coordinates[0] !== 'number' ||
          typeof parsedLocation.coordinates[1] !== 'number') {
          return res.status(400).json({
            success: false,
            message: "Valid coordinates [longitude, latitude] are required"
          });
        }

        // Validate coordinate ranges
        const [longitude, latitude] = parsedLocation.coordinates;
        if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
          return res.status(400).json({
            success: false,
            message: "Invalid coordinates. Longitude: -180 to 180, Latitude: -90 to 90"
          });
        }
      } else {
        // Default location for online events
        parsedLocation = { name: "Online", coordinates: [0, 0] };
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid location format"
      });
    }

    if (parsedTimeline?.length) {
      for (const day of parsedTimeline) {
        if (!day.date || !day.activities?.length) {
          return res.status(400).json({
            success: false,
            message: "Invalid timeline format"
          });
        }

        for (const act of day.activities) {
          if (!act.title || !act.startTime) {
            return res.status(400).json({
              success: false,
              message: "Activity must have title and startTime"
            });
          }
        }
      }
    }

    const event = await Event.create({
      title,
      description,
      banners,
      eventType,
      college: {
        collegeId: college._id,
        collegeName: college.name
      },
      club: {
        clubId: club._id,
        clubName: club.name
      },
      createdBy: user._id,
      startDate,
      endDate,
      location: {
        name: parsedLocation.name,
        coordinates: parsedLocation.coordinates
      },
      mode,
      registration: parsedRegistration,
      timeline: parsedTimeline,
      status: "PUBLISHED"
    });

    await User.updateOne(
      { _id: user._id },
      {
        $inc: {
          "activity.eventsCreated": 1,
          "performance.score": PERFORMANCE_RULES.EVENT_CREATED
        }
      }
    );
    await Club.updateOne(
      { _id: club._id },
      {
        $push: { events: event._id },
        $inc: {
          "stats.eventsHosted": 1,
          "performance.score": PERFORMANCE_RULES.EVENT_CREATED
        }
      }
    );
    await College.updateOne(
      { _id: college._id },
      {
        $inc: { "stats.eventsHosted": 1 }
      }
    );

    return res.status(201).json({
      success: true,
      message: "Event created successfully",
      data: event
    });

  } catch (error) {
    console.error("Add Event Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while creating event"
    });
  }
};

const addGlobalEvent = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user || user.role !== USER_TYPE.SUPER_ADMIN) {
      return res.status(403).json({
        success: false,
        message: "Only Super Admins can create global events"
      });
    }

    const {
      title,
      description,
      eventType,
      startDate,
      endDate,
      location,
      mode,
      registration,
      timeline,
      rewardPoints
    } = req.body;

    if (!title || !eventType) {
      return res.status(400).json({
        success: false,
        message: "Title and eventType are required"
      });
    }

    let banners = [];
    if (req.files?.banners) {
      banners = req.files.banners.map(file => ({
        url: file.path,
        public_id: file.filename
      }));
    }

    const parsedRegistration = typeof registration === "string"
      ? JSON.parse(registration)
      : registration;

    const parsedTimeline = typeof timeline === "string"
      ? JSON.parse(timeline)
      : timeline;

    const parsedRewardPoints = typeof rewardPoints === "string"
      ? JSON.parse(rewardPoints)
      : rewardPoints;

    if (parsedTimeline?.length) {
      for (const day of parsedTimeline) {
        if (!day.date || !day.activities?.length) {
          return res.status(400).json({
            success: false,
            message: "Invalid timeline format"
          });
        }
        for (const act of day.activities) {
          if (!act.title || !act.startTime) {
            return res.status(400).json({
              success: false,
              message: "Activity must have title and startTime"
            });
          }
        }
      }
    }

    const event = await Event.create({
      title,
      description,
      banners,
      eventType,
      college: null,
      club: null,
      isGlobal: true,
      scope: "GLOBAL",
      createdBy: user._id,
      startDate,
      endDate,
      location,
      mode,
      registration: parsedRegistration,
      timeline: parsedTimeline,
      rewardPoints: parsedRewardPoints || { organizer: 0, participant: 0 },
      status: "PUBLISHED"
    });

    await User.updateOne(
      { _id: user._id },
      {
        $inc: {
          "activity.eventsCreated": 1,
          "performance.score": PERFORMANCE_RULES.EVENT_CREATED * 2
        }
      }
    );

    return res.status(201).json({
      success: true,
      message: "Global event created successfully",
      data: event
    });

  } catch (error) {
    console.error("Add Global Event Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while creating global event"
    });
  }
};

const getAllEvents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      eventType,
      mode,
      status,
      scope, 
      sortBy = "createdAt"
    } = req.query;

    const query = {};

    if (scope === "GLOBAL") {
      query.isGlobal = true;
    } else if (scope === "COLLEGE") {
      query.isGlobal = { $ne: true };
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    if (eventType) query.eventType = eventType;
    if (mode) query.mode = mode;
    if (status) query.status = status;

    const events = await Event.find(query)
      .populate("createdBy", "fullName email")
      .populate("college.collegeId", "name")
      .populate("club.clubId", "name")
      .sort({ [sortBy]: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Event.countDocuments(query);

    res.status(200).json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: events
    });

  } catch (error) {
    console.error("Get All Events Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

const updateGlobalEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const user = await User.findById(req.user.id);

    if (!user || user.role !== USER_TYPE.SUPER_ADMIN) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const event = await Event.findOne({ _id: eventId, isGlobal: true });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Global event not found"
      });
    }

    if (req.files?.banners) {
      for (const banner of event.banners) {
        await cloudinary.uploader.destroy(banner.public_id);
      }
      event.banners = req.files.banners.map(file => ({
        url: file.path,
        public_id: file.filename
      }));
    }

    if (req.body.bannersToDelete) {
      const toDelete = JSON.parse(req.body.bannersToDelete);
      for (const publicId of toDelete) {
        await cloudinary.uploader.destroy(publicId);
      }
      event.banners = event.banners.filter(b => !toDelete.includes(b.public_id));
    }

    const allowedFields = [
      "title", "description", "eventType", "startDate",
      "endDate", "location", "mode", "status", "rewardPoints"
    ];

    if (req.body.rewardPoints) {
      req.body.rewardPoints =
        typeof req.body.rewardPoints === "string"
          ? JSON.parse(req.body.rewardPoints)
          : req.body.rewardPoints;
    }

    if (req.body.registration) {
      event.registration = typeof req.body.registration === "string"
        ? JSON.parse(req.body.registration)
        : req.body.registration;
    }

    if (req.body.timeline) {
      event.timeline = typeof req.body.timeline === "string"
        ? JSON.parse(req.body.timeline)
        : req.body.timeline;
    }

    await event.save();

    res.status(200).json({
      success: true,
      message: "Global event updated successfully",
      data: event
    });

  } catch (error) {
    console.error("Update Global Event Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

const deleteGlobalEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const user = await User.findById(req.user.id);

    if (!user || user.role !== USER_TYPE.SUPER_ADMIN) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const event = await Event.findOne({ _id: eventId, isGlobal: true });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Global event not found"
      });
    }

    // Delete banners from cloudinary
    if (event.banners?.length) {
      for (const banner of event.banners) {
        await cloudinary.uploader.destroy(banner.public_id);
      }
    }

    await Event.findByIdAndDelete(eventId);

    res.status(200).json({
      success: true,
      message: "Global event deleted successfully"
    });

  } catch (error) {
    console.error("Delete Global Event Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};


const getEvents = async (req, res) => {
  try {

    const { collegeId } = req.params;

    let {
      page = 1,
      limit = 10,
      search = "",
      eventType,
      mode,
      status,
      clubId,
      startDate,
      endDate,
      sortBy = "createdAt"
    } = req.query;

    page = Number(page);
    limit = Number(limit);

    const query = {
      "college.collegeId": collegeId
    };

    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    if (eventType) query.eventType = eventType;
    if (mode) query.mode = mode;
    if (status) query.status = status;
    if (clubId) query["club.clubId"] = clubId;

    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) query.startDate.$gte = new Date(startDate);
      if (endDate) query.startDate.$lte = new Date(endDate);
    }

    const events = await Event.find(query)
      .populate("createdBy", "fullName email")
      .sort({ [sortBy]: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Event.countDocuments(query);

    res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: events
    });

  } catch (error) {
    console.error("Get Events Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

const getEventById = async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid eventId"
      });
    }

    const [event, analytics] = await Promise.all([

      Event.findById(eventId)
        .populate("createdBy", "fullName email avatar")
        .populate("form", "fields")
        .lean(),

      EventRegistration.aggregate([
        {
          $match: {
            event: new mongoose.Types.ObjectId(eventId)
          }
        },
        {
          $facet: {

            overview: [
              {
                $group: {
                  _id: null,
                  totalRegistrations: { $sum: 1 },
                  attended: {
                    $sum: {
                      $cond: [{ $eq: ["$attendance", true] }, 1, 0]
                    }
                  },
                  cancelled: {
                    $sum: {
                      $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0]
                    }
                  },
                  completed: {
                    $sum: {
                      $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0]
                    }
                  },
                  totalRevenue: {
                    $sum: {
                      $cond: [
                        { $eq: ["$payment.status", "PAID"] },
                        "$payment.amount",
                        0
                      ]
                    }
                  }
                }
              }
            ],

            paymentStats: [
              {
                $group: {
                  _id: "$payment.status",
                  count: { $sum: 1 }
                }
              }
            ],

            topColleges: [
              {
                $group: {
                  _id: "$college",
                  registrations: { $sum: 1 }
                }
              },
              { $sort: { registrations: -1 } },
              { $limit: 5 }
            ],

            registrationsByDay: [
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
              { $sort: { _id: 1 } }
            ],
            ratings: [
              {
                $match: { rating: { $exists: true, $ne: null } }
              },
              {
                $group: {
                  _id: null,
                  avgRating: { $avg: "$rating" },
                  totalRatings: { $sum: 1 }
                }
              }
            ]
          }
        }
      ])
    ]);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    const stats = analytics[0] || {};

    return res.status(200).json({
      success: true,
      data: {
        event,
        analytics: {
          overview: stats.overview?.[0] || {},
          paymentStats: stats.paymentStats || [],
          topColleges: stats.topColleges || [],
          registrationsByDay: stats.registrationsByDay || [],
          ratings: stats.ratings?.[0] || {}
        }
      }
    });

  } catch (error) {
    console.error("Get Event Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching event"
    });
  }
};

const updateEvent = async (req, res) => {
  try {

    const { eventId, userCollegeId } = req.params;


    console.log('idididi', userCollegeId)

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    if (
      event.college.collegeId.toString() !==
      userCollegeId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    if (req.files?.banners) {

      for (const banner of event.banners) {
        await cloudinary.uploader.destroy(banner.public_id);
      }

      event.banners = req.files.banners.map(file => ({
        url: file.path,
        public_id: file.filename
      }));
    }

    if (req.body.registration) {
      event.registration = {
        ...event.registration,
        ...(
          typeof req.body.registration === "string"
            ? JSON.parse(req.body.registration)
            : req.body.registration
        )
      };
    }

    if (req.body.timeline) {
      event.timeline =
        typeof req.body.timeline === "string"
          ? JSON.parse(req.body.timeline)
          : req.body.timeline;
    }

    const allowedFields = [
      "title",
      "description",
      "eventType",
      "startDate",
      "endDate",
      "location",
      "mode",
      "status"
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        event[field] = req.body[field];
      }
    });

    await event.save();

    res.status(200).json({
      success: true,
      message: "Event updated successfully",
      data: event
    });

  } catch (error) {
    console.error("Update Event Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const { eventId, userCollegeId } = req.params;

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    if (event.college.collegeId.toString() !== userCollegeId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }
    if (event.banners && event.banners.length > 0) {
      for (const banner of event.banners) {
        await cloudinary.uploader.destroy(banner.public_id);
      }
    }

    await Event.findByIdAndDelete(eventId);

    await Club.updateOne(
      { _id: event.club.clubId },
      {
        $pull: { events: eventId },
        $inc: { "stats.eventsHosted": -1 }
      }
    );

    await College.updateOne(
      { _id: event.college.collegeId },
      { $inc: { "stats.eventsHosted": -1 } }
    );

    res.status(200).json({
      success: true,
      message: "Event deleted successfully"
    });

  } catch (error) {
    console.error("Delete Event Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

const getEventRegistrations = async (req, res) => {
  try {

    const { eventId } = req.params;

    let {
      page = 1,
      limit = 10,
      search = "",
      paymentStatus,
      attendance,
      minRewards,
      status,
      sortBy = "createdAt"
    } = req.query;

    page = Number(page);
    limit = Number(limit);

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    const query = { event: eventId };

    if (paymentStatus) query["payment.status"] = paymentStatus;
    if (attendance !== undefined) query.attendance = attendance === "true";
    if (status) query.status = status;

    if (minRewards) {
      query.rewardPointsEarned = { $gte: Number(minRewards) };
    }

    const registrations = await EventRegistration.find(query)
      .populate("user", "fullName email")
      .populate("college", "name")
      .sort({ [sortBy]: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const filtered = search
      ? registrations.filter(r =>
        r.user?.fullName.toLowerCase().includes(search.toLowerCase())
      )
      : registrations;

    const total = await EventRegistration.countDocuments(query);

    res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: filtered
    });

  } catch (error) {
    console.error("Get Registrations Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

const createEventForm = async (req, res) => {
    try {
        const { eventId } = req.params;
        const { fields } = req.body;

        if (!eventId) {
            return res.status(400).json({
                success: false,
                message: "Event ID is required"
            });
        }

        if (!fields || !Array.isArray(fields)) {
            return res.status(400).json({
                success: false,
                message: "Fields array is required"
            });
        }

        const event = await Event.findById(eventId);

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        const form = await EventForm.findOneAndUpdate(
            { event: eventId },
            { event: eventId, fields },
            { new: true, upsert: true }
        );

        if (!event.form || event.form.toString() !== form._id.toString()) {
            event.form = form._id;
            await event.save();
        }

        return res.status(201).json({
            success: true,
            message: "Event form created successfully",
            data: form
        });

    } catch (err) {
        console.error("Create Event Form Error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while creating event form",
            error: err.message
        });
    }
};

const updateEventForm = async (req, res) => {
    try {

        const { eventId } = req.params;
        const { fields } = req.body;

        if (!eventId) {
            return res.status(400).json({
                success: false,
                message: "Event ID is required"
            });
        }

        if (!fields || !Array.isArray(fields)) {
            return res.status(400).json({
                success: false,
                message: "Fields array is required"
            });
        }

        const form = await EventForm.findOneAndUpdate(
            { event: eventId },
            { fields },
            { new: true }
        );

        if (!form) {
            return res.status(404).json({
                success: false,
                message: "Event form not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Event form updated successfully",
            data: form
        });

    } catch (err) {
        console.error("Update Event Form Error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while updating event form",
            error: err.message
        });
    }
};

const deleteEventForm = async (req, res) => {
    try {

        const { eventId } = req.params;

        if (!eventId) {
            return res.status(400).json({
                success: false,
                message: "Event ID is required"
            });
        }

        const form = await EventForm.findOneAndDelete({
            event: eventId
        });

        if (!form) {
            return res.status(404).json({
                success: false,
                message: "Event form not found"
            });
        }

        await Event.findByIdAndUpdate(
            eventId,
            { $unset: { form: "" } }
        );

        return res.status(200).json({
            success: true,
            message: "Event form deleted successfully"
        });

    } catch (err) {
        console.error("Delete Event Form Error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while deleting event form",
            error: err.message
        });
    }
};

const markAttendance = async (req, res) => {
  try {

    const { eventId, userId } = req.params;
    const { attendance } = req.body;

    if (typeof attendance !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Attendance must be true or false"
      });
    }

    const registration = await EventRegistration
      .findOne({ event: eventId, user: userId })
      .populate("user", "fullName email rewards")
      .populate("event", "title rewardPoints");

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found"
      });
    }

    const wasMarked = registration.attendance?.marked || false;

    if (wasMarked === attendance) {
      return res.json({
        success: true,
        message: "Attendance already updated"
      });
    }

    registration.attendance = {
      marked: attendance,
      markedAt: new Date(),
      markedBy: req.user.id
    };

    await registration.save();

    if (!wasMarked && attendance === true) {

      const reward = registration.event?.rewardPoints?.participant || 5;

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          $inc: { "rewards.points": reward },
          $push: {
            "rewards.rewardHistory": {
              title: "Event Attendance",
              description: `Attended ${registration.event.title}`,
              date: new Date()
            }
          }
        },
        { new: true }
      );

      const newTier = getRewardTierByPoints(updatedUser.rewards.points);

      if (updatedUser.rewards.tier !== newTier) {
        updatedUser.rewards.tier = newTier;
        await updatedUser.save();
      }
    }

    if (attendance === true) {
      await sendEmail({
        to: registration.user.email,
        subject: `Attendance Confirmed - ${registration.event.title}`,
        template: "templates/attendance-confirmation",
        data: {
          name: registration.user.fullName,
          eventName: registration.event.title,
          date: new Date().toLocaleDateString()
        }
      });
    }

    return res.json({
      success: true,
      message: "Attendance marked successfully"
    });

  } catch (err) {

    console.error("Attendance Error:", err);

    res.status(500).json({
      success: false,
      message: "Failed to mark attendance"
    });
  }
};

const generateAttendanceQR = async (req, res) => {
    try {

        const { eventId } = req.params;

        if (!eventId) {
            return res.status(400).json({
                success: false,
                message: "Event ID is required"
            });
        }

        const token = jwt.sign(
            {
                eventId,
                type: "ATTENDANCE_QR"
            },
            process.env.QR_SECRET,
            {
                expiresIn: "30s"
            }
        );

        return res.status(200).json({
            success: true,
            message: "QR code generated successfully",
            token
        });

    } catch (err) {
        console.error("Generate Attendance QR Error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while generating QR code",
            error: err.message
        });
    }
};

const scanAttendanceQR = async (req, res) => {
  try {

    const { token, lat, lng } = req.body;
    const userId = req.user.id;

    const decoded = jwt.verify(token, process.env.QR_SECRET);

    const event = await Event.findById(decoded.eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    const venueLat = event.location.coordinates[1];
    const venueLng = event.location.coordinates[0];

    const distance = getDistanceInMeters(
      lat,
      lng,
      venueLat,
      venueLng
    );

    if (distance > 500) {
      return res.status(403).json({
        success: false,
        message: "You are not at the event location"
      });
    }

    const registration = await EventRegistration.findOne({
      event: event._id,
      user: userId
    });

    if (!registration) {
      return res.status(400).json({
        success: false,
        message: "Not registered"
      });
    }

    if (registration.attendance?.marked) {
      return res.json({
        success: true,
        message: "Already checked in"
      });
    }

    registration.attendance = {
      marked: true,
      markedAt: new Date(),
      method: "QR",
      location: { lat, lng }
    };

    await registration.save();

    res.json({
      success: true,
      message: "Attendance marked!"
    });

  } catch (err) {

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "QR expired — scan again"
      });
    }
    console.log('error in scan attendance', err);

    res.status(500).json({
      success: false,
      message: "Scan failed"
    });
  }
};

module.exports = { addEvent, getEvents, updateEvent, deleteEvent, getEventRegistrations, getEventById, createEventForm, updateEventForm, deleteEventForm, getAllEvents, deleteGlobalEvent, updateGlobalEvent, addGlobalEvent, markAttendance, generateAttendanceQR, scanAttendanceQR};