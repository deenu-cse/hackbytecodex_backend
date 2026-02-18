const mongoose = require("mongoose");

const collegeSchema = new mongoose.Schema({

  // ===== BASIC INFO =====
  name: {
    type: String,
    required: true,
    trim: true
  },

  code: {
    type: String, // unique college code (HBX-001 etc.)
    unique: true
  },

  email: {
    type: String
  },

  phone: {
    type: String
  },

  website: {
    type: String
  },

  address: {
    city: String,
    state: String,
    country: { type: String, default: "India" }
  },

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

  // ===== OWNERSHIP & ADMINS =====
  collegeLead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  admins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],

  // ===== CLUBS UNDER COLLEGE =====
  clubs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Club"
  }],

  // ===== RATINGS & PERFORMANCE =====
  performance: {
    rating: { type: Number, default: 0 },   // avg rating (0–5)
    score: { type: Number, default: 0 },    // internal score (0–100)
    tier: {
      type: String,
      enum: ["BRONZE", "SILVER", "GOLD", "PLATINUM"],
      default: "BRONZE"
    }
  },

  // ===== REWARD SYSTEM =====
  rewards: {
    points: { type: Number, default: 0 },
    history: [{
      title: String,
      points: Number,
      reason: String,
      date: { type: Date, default: Date.now }
    }]
  },

  // ===== ACTIVITY METRICS =====
  stats: {
    eventsHosted: { type: Number, default: 0 },
    hackathonsHosted: { type: Number, default: 0 },
    activeStudents: { type: Number, default: 0 },
    clubsCount: { type: Number, default: 0 }
  },

  // ===== APPROVAL & STATUS =====
  isVerified: {
    type: Boolean,
    default: false
  },

  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User" // SUPER_ADMIN / CORE_TEAM
  },

  status: {
    type: String,
    enum: ["PENDING", "ACTIVE", "SUSPENDED"],
    default: "PENDING"
  }

}, { timestamps: true });

collegeSchema.index({ name: 1, code: 1 });
collegeSchema.index({ status: 1 });
collegeSchema.index({
  name: "text",
  code: "text",
  "address.city": "text",
  "address.state": "text"
});

module.exports = mongoose.model("College", collegeSchema);