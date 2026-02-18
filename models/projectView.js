const mongoose = require("mongoose");

const viewSchema = new mongoose.Schema({

 project:{
   type:mongoose.Schema.Types.ObjectId,
   ref:"Project",
   index:true
 },

 viewerHash:String, 

},{timestamps:true});

module.exports = mongoose.model("ProjectView",viewSchema);