const mongoose = require("mongoose");
const slugify = require("slugify");

const eventSchema = new mongoose.Schema({

  // ===== BASIC INFO =====
  title: {
    type: String,
    required: true
  },

  slug: {
    type: String,
    unique: true,
    index: true
  },

  description: String,

  banners: [
    {
      url: String,
      public_id: String
    }
  ],

  eventType: {
    type: String,
    enum: ["HACKATHON", "WORKSHOP", "SEMINAR", "COMPETITION"],
    required: true
  },

  timeline: [
    {
      date: {
        type: Date,
        required: true
      },
      activities: [
        {
          title: {
            type: String,
            required: true
          },
          description: String,
          startTime: {
            type: String,
            required: true
          },
          endTime: String,
          location: String
        }
      ]
    }
  ],

  // ===== OWNERSHIP =====
  college: {
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: "College" },
    collegeName: String
  },

  club: {
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club" },
    clubName: String
  },

  isGlobal: {
    type: Boolean,
    default: false
  },

  scope: {
    type: String,
    enum: ["COLLEGE", "GLOBAL", "CLUB"],
    default: "COLLEGE"
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  // ===== SCHEDULE =====
  startDate: Date,
  endDate: Date,
  location: {
    name: String,
    type: {
      type: String,
      default: "Point"
    },
    coordinates: {
      type: [Number],
      index: "2dsphere"
    }
  },
  mode: {
    type: String,
    enum: ["ONLINE", "OFFLINE", "HYBRID"]
  },

  // ===== REGISTRATION CONFIG =====
  registration: {
    isOpen: { type: Boolean, default: true },
    lastDate: Date,
    limit: Number,
    fee: { type: Number, default: 0 }
  },

  // ===== PARTICIPATION =====
  registrations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "EventRegistration"
  }],

  participantsCount: {
    type: Number,
    default: 0
  },

  // ===== RATINGS & REWARDS =====
  performance: {
    rating: { type: Number, default: 0 },
    score: { type: Number, default: 0 }
  },

  rewardPoints: {
    organizer: { type: Number, default: 0 },
    participant: { type: Number, default: 0 }
  },

  status: {
    type: String,
    enum: ["DRAFT", "PUBLISHED", "COMPLETED", "CANCELLED"],
    default: "DRAFT"
  },
  form: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "EventForm",
    default: null
  }

}, { timestamps: true });

eventSchema.pre("save", function (next) {
  if (this.isModified("title")) {
    this.slug = slugify(this.title, {
      lower: true,
      strict: true
    });
  }
  next();
});

eventSchema.index({ "college.collegeId": 1 });
eventSchema.index({ eventType: 1 });
eventSchema.index({ startDate: 1 });
eventSchema.index({ title: "text", description: "text" });
eventSchema.index({ "registration.fee": 1 });
eventSchema.index({ mode: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ createdAt: -1 });
eventSchema.index({ "timeline.date": 1 });
eventSchema.index({ "location.coordinates": "2dsphere" });

module.exports = mongoose.model("Event", eventSchema);