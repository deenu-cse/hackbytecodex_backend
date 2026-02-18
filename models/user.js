const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

  // ===== BASIC INFO =====
  fullName: {
    type: String,
    required: true,
    trim: true
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },

  phone: {
    type: String
  },

  avatar: {
    type: String
  },

  password: {
    type: String, 
    select: false
  },

  // ===== ROLE & ACCESS =====
  role: {
    type: String,
    enum: [
      "SUPER_ADMIN",
      "CORE_TEAM",
      "COLLEGE_LEAD",
      "CLUB_ADMIN",
      "MENTOR",
      "STUDENT"
    ],
    default: "STUDENT"
  },

  permissions: [{
    type: String // e.g. CREATE_EVENT, APPROVE_COLLEGE
  }],

  // ===== COLLEGE & CLUB MAPPING =====
  college: {
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: "College" },
    collegeName: String,
    isVerified: { type: Boolean, default: false }
  },

  clubs: [{
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club" },
    role: {
      type: String,
      enum: ["CLUB_ADMIN", "MEMBER"]
    }
  }],

  // ===== PERFORMANCE & RATINGS =====
  performance: {
    rating: { type: Number, default: 0 },        // 0–5 stars
    score: { type: Number, default: 0 },         // 0–100
    rank: { type: Number },
    badges: [{
      type: String
    }]
  },

  // ===== REWARDS & INCENTIVES =====
  rewards: {
    points: { type: Number, default: 0 },
    tier: {
      type: String,
      enum: ["BRONZE", "SILVER", "GOLD", "PLATINUM"],
      default: "BRONZE"
    },
    rewardHistory: [{
      title: String,
      description: String,
      date: { type: Date, default: Date.now }
    }]
  },

  // ===== ACTIVITY TRACKING =====
  activity: {
    eventsCreated: { type: Number, default: 0 },
    eventsParticipated: { type: Number, default: 0 },
    hackathonsHosted: { type: Number, default: 0 },
    collegesOnboarded: { type: Number, default: 0 }
  },

  // ===== STATUS & CONTROL =====
  status: {
    type: String,
    enum: ["ACTIVE", "INACTIVE", "SUSPENDED"],
    default: "ACTIVE"
  },

  isVerified: {
    type: Boolean,
    default: false
  },

  lastLogin: {
    type: Date
  }

}, { timestamps: true });

userSchema.index({ "clubs.clubId": 1 });


module.exports = mongoose.model("User", userSchema);