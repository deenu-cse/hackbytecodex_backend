const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middlewares/authMiddlewares/verifyToken');
const { getAllClubs, getClubsByCollege, getClubByCode, assignClubAdmin, getClubMembers, joinClub } = require('../../controllers/club/clubController');
const { USER_TYPE } = require('../../constants/allConstant');

router.get('/', verifyToken([USER_TYPE.COLLEGE_LEAD, USER_TYPE.CLUB_ADMIN, USER_TYPE.STUDENT]), getAllClubs);

router.get('/college/:collegeId', verifyToken([USER_TYPE.COLLEGE_LEAD, USER_TYPE.CLUB_ADMIN, USER_TYPE.STUDENT]), getClubsByCollege);

router.get('/code/:clubCode', verifyToken([USER_TYPE.COLLEGE_LEAD, USER_TYPE.CLUB_ADMIN, USER_TYPE.STUDENT]), getClubByCode);

router.get(
    '/:clubId/members',
    verifyToken([USER_TYPE.COLLEGE_LEAD, USER_TYPE.CLUB_ADMIN, USER_TYPE.STUDENT]),
    getClubMembers
);

router.post(
  "/assignClubAdmin",
  verifyToken([USER_TYPE.COLLEGE_LEAD]),
  assignClubAdmin
);

router.post(
  "/join/:clubCode",
  verifyToken([USER_TYPE.STUDENT]),
  joinClub
);

module.exports = router;