const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("./cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,

  params: async (req, file) => {

    const userId = req.user?.id || "temp";

    let resource_type = "image";
    let folder = `projects/${userId}/images`;

    if (file.mimetype.startsWith("video")) {
      resource_type = "video";
      folder = `projects/${userId}/videos`;
    }

    return {
      folder,
      resource_type,
      allowed_formats: ["jpg","png","jpeg","webp","mp4","mov","webm"],
      transformation:
        resource_type === "image"
          ? [{ width: 1600, crop: "limit", quality: "auto" }]
          : []
    };
  }
});

const upload = multer({
  storage,
  limits:{
    fileSize: 1024 * 1024 * 120 
  }
});

const uploadProjectMedia = upload.fields([
  { name:"cover", maxCount:1 },
  { name:"images", maxCount:6 },
  { name:"videos", maxCount:2 }
]);

module.exports = uploadProjectMedia;