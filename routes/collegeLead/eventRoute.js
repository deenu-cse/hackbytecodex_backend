const express = require("express");
const { addEvent, getEvents, updateEvent, getEventRegistrations, getEventById, deleteEvent, createEventForm, updateEventForm, deleteEventForm, getAllEvents, addGlobalEvent, deleteGlobalEvent, updateGlobalEvent, markAttendance, generateAttendanceQR, scanAttendanceQR } = require("../../controllers/collegeLead/eventController");
const { verifyToken } = require("../../middlewares/authMiddlewares/verifyToken");
const { USER_TYPE } = require("../../constants/allConstant");
const uploadEventMedia = require("../../middlewares/cloudinary/uploadEventMedia");

const router = express.Router();

router.post(
  "/add-event",
  verifyToken([USER_TYPE.COLLEGE_LEAD]),
  uploadEventMedia,
  addEvent
);

router.post(
  "/global",
  verifyToken([USER_TYPE.SUPER_ADMIN]),
  uploadEventMedia,
  addGlobalEvent
);

router.put(
  "/global/:eventId",
  verifyToken([USER_TYPE.SUPER_ADMIN]),
  uploadEventMedia,
  updateGlobalEvent
);

router.delete(
  "/global/:eventId",
  verifyToken([USER_TYPE.SUPER_ADMIN]),
  deleteGlobalEvent
);


router.get(
  "/all",
  verifyToken([USER_TYPE.SUPER_ADMIN]),
  getAllEvents
);

router.post(
  "/:eventId/add-event-form",
  verifyToken([USER_TYPE.COLLEGE_LEAD, USER_TYPE.CLUB_ADMIN, USER_TYPE.SUPER_ADMIN]),
  createEventForm
);

router.put(
  "/:eventId/updateform",
  verifyToken([USER_TYPE.COLLEGE_LEAD, USER_TYPE.STUDENT, USER_TYPE.SUPER_ADMIN]),
  updateEventForm
);

router.delete(
  "/:eventId/deleteform",
  verifyToken([USER_TYPE.COLLEGE_LEAD, USER_TYPE.STUDENT, USER_TYPE.SUPER_ADMIN]),
  deleteEventForm
);

router.get(
  "/college/:collegeId",
  verifyToken([USER_TYPE.COLLEGE_LEAD, USER_TYPE.STUDENT]),
  getEvents
);

router.get(
  "/single/:eventId",
  verifyToken([USER_TYPE.COLLEGE_LEAD, USER_TYPE.STUDENT, USER_TYPE.SUPER_ADMIN]),
  getEventById
);

router.put(
  "/:eventId/:userCollegeId",
  verifyToken([USER_TYPE.COLLEGE_LEAD]),
  uploadEventMedia,
  updateEvent
);

router.delete(
  "/:eventId/:userCollegeId",
  verifyToken([USER_TYPE.COLLEGE_LEAD]),
  deleteEvent
);

router.get(
  "/:eventId/registrations",
  verifyToken([USER_TYPE.COLLEGE_LEAD, USER_TYPE.SUPER_ADMIN, USER_TYPE.STUDENT]),
  getEventRegistrations
);

router.put(
  "/:eventId/registrations/:userId/attendance",
  verifyToken([USER_TYPE.COLLEGE_LEAD, USER_TYPE.SUPER_ADMIN]),
  markAttendance
);

router.get(
  "/:eventId/qr",
  verifyToken([USER_TYPE.COLLEGE_LEAD, USER_TYPE.SUPER_ADMIN]),
  generateAttendanceQR
);

router.post(
  "/qr/attendance",
  verifyToken(),
  scanAttendanceQR
)

module.exports = router;
