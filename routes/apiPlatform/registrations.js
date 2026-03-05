const express = require("express");
const router = express.Router();
const { verifyApiKey } = require("../../middlewares/apiPlatform/verifyApiKey");
const { rateLimiter } = require("../../middlewares/apiPlatform/rateLimiter");
const { auditLogger } = require("../../middlewares/apiPlatform/auditLogger");
const { tierGuard } = require("../../middlewares/apiPlatform/tierGuard");
const { verifyPlatformToken } = require("../../middlewares/apiPlatform/verifyPlatformToken");
const {
    registerForEvent,
    getRegistrations,
    getRegistration,
    markAttendance
} = require("../../controllers/apiPlatform/apiRegistrationController");

router.post(
    "/events/:eventId/register",
    verifyApiKey,
    rateLimiter,
    auditLogger,
    registerForEvent
);

router.get(
    "/events/:eventId/registrations",
    verifyPlatformToken,
    getRegistrations
);

router.get(
    "/events/:eventId/registrations/:regId",
    verifyPlatformToken,
    getRegistration
);

router.put(
    "/events/:eventId/registrations/:regId/attendance",
    verifyPlatformToken,
    markAttendance
);

module.exports = router;
