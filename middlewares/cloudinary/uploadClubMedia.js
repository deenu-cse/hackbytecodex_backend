const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("./cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {

    const collegeId =
      req.body?.collegeId ||
      req.user?.college?._id?.toString() ||
      req.user?.college?.toString();

    let folder = "clubs/general";

    if (collegeId) {
      folder = `clubs/${collegeId}`;
    }

    return {
      folder,
      resource_type: "image",
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      transformation: [{ width: 1000, crop: "limit" }],
    };
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, 
  },
});


const uploadClubMedia = upload.fields([
  { name: "logo", maxCount: 1 },
  { name: "banners", maxCount: 5 },
]);

module.exports = uploadClubMedia;
