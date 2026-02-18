const mongoose = require("mongoose");

const eventFormSchema = new mongoose.Schema({

  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    unique: true
  },

  fields: [
    {
      label: String, // "GitHub URL"
      name: String,  // "github"
      type: {
        type: String,
        enum: ["TEXT", "EMAIL", "NUMBER", "SELECT", "FILE", "CHECKBOX"]
      },
      required: Boolean,
      options: [String], // for SELECT
      placeholder: String
    }
  ]

}, { timestamps: true });

module.exports = mongoose.model("EventForm", eventFormSchema);