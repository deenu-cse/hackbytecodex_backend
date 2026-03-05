const express = require("express");
const router = express.Router();
const { verifyPlatformToken } = require("../../middlewares/apiPlatform/verifyPlatformToken");
const { tierGuard } = require("../../middlewares/apiPlatform/tierGuard");
const {
    createEvent,
    getEvents,
    getEvent,
    updateEvent,
    deleteEvent,
    publishEvent
} = require("../../controllers/apiPlatform/apiEventController");
const {
    createForm,
    getForm,
    updateForm,
    deleteForm
} = require("../../controllers/apiPlatform/apiFormController");

router.use(verifyPlatformToken);

router.post("/", tierGuard("events"), createEvent);
router.get("/", getEvents);
router.get("/:eventId", getEvent);
router.put("/:eventId", updateEvent);
router.delete("/:eventId", deleteEvent);
router.post("/:eventId/publish", publishEvent);

router.post("/:eventId/form", createForm);
router.get("/:eventId/form", getForm);
router.put("/:eventId/form", updateForm);
router.delete("/:eventId/form", deleteForm);

module.exports = router;
