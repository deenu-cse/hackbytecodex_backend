const express = require('express');
const { awardCollegePoints, awardClubPoints, awardUserPoints } = require('../../controllers/admin/rewardController');
const { verifyToken } = require('../../middlewares/authMiddlewares/verifyToken');
const { USER_TYPE } = require('../../constants/allConstant');

const router = express.Router();

// Award points to a college
router.post(
  '/college/:collegeId',
  verifyToken([USER_TYPE.SUPER_ADMIN, USER_TYPE.COLLEGE_LEAD]),
  awardCollegePoints
);

// Award points to a club
router.post(
  '/club/:clubId',
  verifyToken([USER_TYPE.SUPER_ADMIN, USER_TYPE.COLLEGE_LEAD]),
  awardClubPoints
);

// Award points to a user
router.post(
  '/user/:userId',
  verifyToken([USER_TYPE.SUPER_ADMIN, USER_TYPE.COLLEGE_LEAD]),
  awardUserPoints
);

module.exports = router;
