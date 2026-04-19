const mongoose = require("mongoose");

const eventRatingSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },

  review: {
    type: String,
    maxlength: 500
  },

  isAnonymous: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Compound index to ensure one rating per user per event
eventRatingSchema.index({ eventId: 1, userId: 1 }, { unique: true });

eventRatingSchema.index({ eventId: 1 });
eventRatingSchema.index({ userId: 1 });
eventRatingSchema.index({ rating: 1 });

module.exports = mongoose.model("EventRating", eventRatingSchema);