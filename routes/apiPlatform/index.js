const express = require("express");
const router = express.Router();

const billingRoutes = require("./billing");
const platformAuthRoutes = require("./platformAuth");
const eventRoutes = require("./events");
const registrationRoutes = require("./registrations");
const judgeRoutes = require("./judges");
const analyticsRoutes = require("./analytics");
const settingsRoutes = require("./settings");

router.use("/billing", billingRoutes);
router.use("/auth", platformAuthRoutes);
router.use("/events", eventRoutes);
router.use("/", registrationRoutes);
router.use("/", judgeRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/", settingsRoutes);

module.exports = router;
