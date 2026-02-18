const express = require('express');
const router = express.Router();
const adminCollegeRoute = require('./collageRoutes')

router.use('/college', adminCollegeRoute);

module.exports = router;