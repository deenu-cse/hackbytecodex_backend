const express = require("express");
const { 
  assignJudge, 
  submitScore, 
  LockScoresForEvent, 
  generateLeaderboard,
  getEventJudges,
  verifyJudge,
  getJudgeScores,
  getLeaderboard,
  getGlobalLeaderboard
} = require("../../controllers/judge/judgeController");
const { USER_TYPE } = require("../../constants/allConstant");
const { verifyToken } = require("../../middlewares/authMiddlewares/verifyToken");
const router = express.Router();

router.post('/add-judge/:eventId', verifyToken([USER_TYPE.COLLEGE_LEAD, USER_TYPE.CLUB_ADMIN, USER_TYPE.SUPER_ADMIN]), assignJudge);
router.get('/event/:eventId', verifyToken([USER_TYPE.COLLEGE_LEAD, USER_TYPE.SUPER_ADMIN]), getEventJudges);
router.patch('/score/lock-event/:eventId', verifyToken([USER_TYPE.COLLEGE_LEAD, USER_TYPE.SUPER_ADMIN]), LockScoresForEvent);
router.post('/leaderboard/:eventId/generate', verifyToken([USER_TYPE.COLLEGE_LEAD, USER_TYPE.SUPER_ADMIN]), generateLeaderboard);

router.get('/verify/:eventId', verifyToken(), verifyJudge);
router.post('/score', verifyToken(), submitScore);
router.get('/scores/:eventId', verifyToken(), getJudgeScores);
router.get('/leaderboard/:eventId', getLeaderboard);

router.get("/global/leaderboard", getGlobalLeaderboard);

module.exports = router;