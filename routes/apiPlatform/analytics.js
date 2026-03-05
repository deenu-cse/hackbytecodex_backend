const express = require("express");
const router = express.Router();
const { verifyPlatformToken } = require("../../middlewares/apiPlatform/verifyPlatformToken");
const { tierGuard } = require("../../middlewares/apiPlatform/tierGuard");
const {
    getDashboard,
    getEventOverview,
    getRegistrationTrends,
    getFormBreakdown,
    getScoringAnalytics,
    compareEvents
} = require("../../controllers/apiPlatform/analyticsController");

router.use(verifyPlatformToken);

router.get("/dashboard", getDashboard);

router.get("/events/:eventId/overview", getEventOverview);

router.get(
    "/events/:eventId/trends",
    tierGuard("analytics", "FULL"),
    getRegistrationTrends
);

router.get(
    "/events/:eventId/form-breakdown",
    tierGuard("analytics", "FULL"),
    getFormBreakdown
);

router.get("/events/:eventId/scoring", getScoringAnalytics);

router.get(
    "/events/compare",
    tierGuard("analytics", "FULL"),
    compareEvents
);

module.exports = router;
