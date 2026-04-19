const express = require('express');
const router = express.Router();
const adminCollegeRoute = require('./collageRoutes')
const rewardRoutes = require('./rewardRoutes')
const emailRoutes = require('./emailRoutes')

router.use('/college', adminCollegeRoute);
router.use('/rewards', rewardRoutes);
router.use('/email', emailRoutes);

module.exports = router;