const express = require('express')
const router = express.Router()
const userEventRoute = require('./eventRoute')

router.use('/events', userEventRoute)

module.exports = router;