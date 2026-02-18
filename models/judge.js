const mongoose = require("mongoose");


const judgeSchema = new mongoose.Schema({

   user:{
      type: mongoose.Schema.Types.ObjectId,
      ref:"User",
      required:true
   },

   events:[{
      type: mongoose.Schema.Types.ObjectId,
      ref:"Event"
   }],

   role:{
      type:String,
      enum:["JUDGE","HEAD_JUDGE"],
      default:"JUDGE"
   },

   isActive:{
      type:Boolean,
      default:true
   }

},{timestamps:true})

module.exports = mongoose.model("Judge",judgeSchema)