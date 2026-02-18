const express = require('express');
const { registerForEvent } = require('../../controllers/public/events/eventsController');
const router = express.Router();

router.post('/register/:eventId', registerForEvent);

module.exports = router;