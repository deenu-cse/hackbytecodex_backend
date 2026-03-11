const mongoose = require("mongoose");

const eventFormSchema = new mongoose.Schema({

  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    unique: true
  },

  fields: [
    {
      label: String, 
      name: String,  
      type: {
        type: String,
        enum: ["TEXT", "EMAIL", "NUMBER", "SELECT", "FILE", "CHECKBOX", "DATE"] 
      },
      required: Boolean,
      options: [String],
      placeholder: String,
      minDate: String, 
      maxDate: String, 
      dateFormat: {   
        type: String,
        default: "YYYY-MM-DD"
      }
    }
  ],

  instructions: [
    {
      heading: String,  
      points: [String]  
    }
  ]

}, { timestamps: true });

module.exports = mongoose.model("EventForm", eventFormSchema);