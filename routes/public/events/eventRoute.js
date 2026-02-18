const express = require('express');
const { getAllEvents, getEventBySlug, registerForEvent, getEventForm } = require('../../../controllers/public/events/eventsController');
const { verifyToken } = require('../../../middlewares/authMiddlewares/verifyToken');
const { USER_TYPE } = require('../../../constants/allConstant');
const router = express.Router();
const multer = require("multer");
const uploadEventFiles = require('../../../middlewares/cloudinary/uploadEventFiles');

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get(
    "/all",
    getAllEvents
);

router.get(
    "/:slug",
    getEventBySlug
);

router.get(
    "/form/:slug",
    getEventForm
);

router.post(
  "/register/:slug",
  verifyToken(),
  uploadEventFiles, 
  registerForEvent
);

module.exports = router;