const express = require("express");
const { addClub } = require("../../controllers/collegeLead/clubController");
const { verifyToken } = require("../../middlewares/authMiddlewares/verifyToken");
const { USER_TYPE } = require("../../constants/allConstant");
const { generateClubInviteLink } = require("../../controllers/collegeLead/clubInviteController");
const uploadClubMedia = require("../../middlewares/cloudinary/uploadClubMedia");

const router = express.Router();

router.post(
  "/add-club",
  verifyToken([USER_TYPE.COLLEGE_LEAD]),
  uploadClubMedia,
  addClub
);

router.get(
  "/club/invite/:clubId",
  verifyToken([USER_TYPE.COLLEGE_LEAD]),
  generateClubInviteLink
);

module.exports = router;
