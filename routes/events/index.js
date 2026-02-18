const express = require('express');
const registerEvent = require('./registerForEvent');
const router = express.Router();

router.use('/regevent', registerEvent);

module.exports = router;