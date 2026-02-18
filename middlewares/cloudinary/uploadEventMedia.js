const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("./cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {

    let folder = "events";

    // 🔥 MUCH BETTER structure
    // events/{collegeId}/{clubId}

    if (req.user?.college?.collegeId) {
      folder = `events/${req.user.college.collegeId}`;
    }

    if (req.body.clubId) {
      folder += `/${req.body.clubId}`;
    }

    return {
      folder,
      allowed_formats: ["jpg", "png", "jpeg", "webp"],
      transformation: [{ width: 1200, crop: "limit" }]
    };
  },
});

const upload = multer({ storage });

const uploadEventMedia = upload.fields([
  { name: "banners", maxCount: 7 } 
]);

module.exports = uploadEventMedia;
