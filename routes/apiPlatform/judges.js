const express = require("express");
const router = express.Router();
const { verifyPlatformToken } = require("../../middlewares/apiPlatform/verifyPlatformToken");
const { verifyJudgeToken } = require("../../middlewares/apiPlatform/verifyJudgeToken");
const { tierGuard } = require("../../middlewares/apiPlatform/tierGuard");
const {
    inviteJudge,
    getJudges,
    deactivateJudge,
    lockScores,
    generateLeaderboard,
    judgeLogin,
    getJudgeRegistrations,
    submitScore,
    updateScore,
    getJudgeLeaderboard
} = require("../../controllers/apiPlatform/apiJudgeController");

// Platform user judge management
router.post(
    "/events/:eventId/judges/invite",
    verifyPlatformToken,
    tierGuard("judges"),
    inviteJudge
);
router.get(
    "/events/:eventId/judges",
    verifyPlatformToken,
    getJudges
);
router.delete(
    "/events/:eventId/judges/:judgeId",
    verifyPlatformToken,
    deactivateJudge
);
router.post(
    "/events/:eventId/scores/lock",
    verifyPlatformToken,
    lockScores
);
router.post(
    "/events/:eventId/leaderboard/generate",
    verifyPlatformToken,
    generateLeaderboard
);

// Judge auth (public)
router.post("/judge-auth/login", judgeLogin);

// Judge panel (authenticated judge)
router.get("/judge/registrations", verifyJudgeToken, getJudgeRegistrations);
router.post("/judge/scores", verifyJudgeToken, submitScore);
router.put("/judge/scores/:scoreId", verifyJudgeToken, updateScore);
router.get("/judge/leaderboard", verifyJudgeToken, getJudgeLeaderboard);

module.exports = router;
