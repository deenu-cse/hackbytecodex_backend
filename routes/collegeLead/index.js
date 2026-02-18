const express = require('express');
const clubRoute = require('./clubRoute');
const eventRoute = require('./eventRoute');
const router = express.Router();

router.use('/clubs', clubRoute);
router.use('/events', eventRoute);

module.exports = router;