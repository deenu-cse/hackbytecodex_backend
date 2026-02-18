const mongoose = require("mongoose");

const clubSchema = new mongoose.Schema({

  // ===== BASIC INFO =====
  name: {
    type: String,
    required: true,
    trim: true
  },

  code: {
    type: String,
    unique: true // CLB-HBX-001
  },

  description: String,

  logo: {
    url: String,
    public_id: String
  },

  banners: [
    {
      url: String,
      public_id: String
    }
  ],

  // ===== COLLEGE LINK =====
  college: {
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: "College" },
    collegeName: String
  },

  // ===== CLUB ADMINS & MEMBERS =====
  admins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],

  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],

  // ===== EVENTS =====
  events: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event"
  }],

  // ===== PERFORMANCE & RATINGS =====
  performance: {
    rating: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    tier: {
      type: String,
      enum: ["BRONZE", "SILVER", "GOLD", "PLATINUM"],
      default: "BRONZE"
    }
  },

  // ===== REWARDS =====
  rewards: {
    points: { type: Number, default: 0 },
    history: [{
      title: String,
      points: Number,
      reason: String,
      date: { type: Date, default: Date.now }
    }]
  },

  // ===== ACTIVITY =====
  stats: {
    eventsHosted: { type: Number, default: 0 },
    activeMembers: { type: Number, default: 0 }
  },

  status: {
    type: String,
    enum: ["ACTIVE", "INACTIVE"],
    default: "ACTIVE"
  }

}, { timestamps: true });

clubSchema.index({ name: "text" });
clubSchema.index({ "performance.tier": 1 });
clubSchema.index({ "performance.score": -1 });
clubSchema.index({ createdAt: -1 });
clubSchema.index({ "college.collegeId": 1, createdAt: -1 });
clubSchema.index({ code: 1 });



module.exports = mongoose.model("Club", clubSchema);