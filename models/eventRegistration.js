const mongoose = require("mongoose");

const eventRegistrationSchema = new mongoose.Schema({

  // ===== CORE LINKS =====
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true
  },

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  college: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "College"
  },

  club: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Club"
  },

  // ===== FORM DATA =====
  formData: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },

  // ===== PAYMENT =====
  payment: {
    status: {
      type: String,
      enum: ["FREE", "PENDING", "PAID", "FAILED"],
      default: "FREE"
    },
    amount: Number,
    transactionId: String
  },

  // ===== ATTENDANCE & RESULT =====
  attendance: {
    marked: {
      type: Boolean,
      default: false
    },
    markedAt: Date,

    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },

  performance: {
    score: {
      type: Number,
      default: 0
    },

    judgesScores: [{
      judge: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      score: Number,
      feedback: String
    }],

    finalScore: Number
  },

  result: {
    position: Number,
    isWinner: {
      type: Boolean,
      default: false
    },
    prize: String
  },

  // ===== FEEDBACK =====
  rating: Number,
  feedback: String,

  // ===== REWARDS =====
  rewardPointsEarned: {
    type: Number,
    default: 0
  },

  status: {
    type: String,
    enum: ["REGISTERED", "CANCELLED", "COMPLETED"],
    default: "REGISTERED"
  }

}, { timestamps: true });

eventRegistrationSchema.index({ event: 1, createdAt: -1 });
eventRegistrationSchema.index({ rewardPointsEarned: -1 });
eventRegistrationSchema.index({ "payment.status": 1 });
eventRegistrationSchema.index(
  { event: 1, user: 1 },
  { unique: true }
);


module.exports = mongoose.model("EventRegistration", eventRegistrationSchema);