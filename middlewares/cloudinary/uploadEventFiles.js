const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("./cloudinary");
const EventForm = require("../../models/eventForm");
const Event = require("../../models/event");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {

    const { slug } = req.params;

    const event = await Event.findOne({ slug });

    return {
      folder: `events/${event._id}/registrations`,
      resource_type: "auto", // 🔥 VERY IMPORTANT (pdf, zip etc.)
      allowed_formats: ["jpg","png","jpeg","webp","pdf","doc","docx"],
    };
  },
});

const multerUpload = multer({ storage });


const uploadEventFiles = async (req, res, next) => {
  try {

    const { slug } = req.params;

    const event = await Event.findOne({ slug });
    const form = await EventForm.findOne({ event: event._id });

    if (!form) return next();

    const fileFields = form.fields
      .filter(f => f.type === "FILE")
      .map(f => ({
        name: f.name,
        maxCount: 1,
      }));

    const uploader = multerUpload.fields(fileFields);

    uploader(req, res, function(err){
      if(err){
        return res.status(400).json({
          success:false,
          message: err.message
        });
      }
      next();
    });

  } catch(err){
    next(err);
  }
};

module.exports = uploadEventFiles;