const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("./cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {

    let folder = "colleges";

    if (req.body.code) {
      folder = `colleges/${req.body.code}`;
    }

    return {
      folder,
      allowed_formats: ["jpg", "png", "jpeg", "webp"],
      transformation: [{ width: 1000, crop: "limit" }] 
    };
  },
});

const upload = multer({ storage });


const uploadCollegeMedia = upload.fields([
  { name: "logo", maxCount: 1 },     
  { name: "banners", maxCount: 5 }, 
]);

module.exports = uploadCollegeMedia;
