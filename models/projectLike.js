const mongoose = require("mongoose");

const likeSchema = new mongoose.Schema({

 user:{
   type:mongoose.Schema.Types.ObjectId,
   ref:"User",
   index:true
 },

 project:{
   type:mongoose.Schema.Types.ObjectId,
   ref:"Project",
   index:true
 }

},{timestamps:true});

likeSchema.index({user:1,project:1},{unique:true});

module.exports = mongoose.model("ProjectLike",likeSchema);