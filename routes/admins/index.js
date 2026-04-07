const express = require('express');
const router = express.Router();
const adminCollegeRoute = require('./collageRoutes')
const rewardRoutes = require('./rewardRoutes')

router.use('/college', adminCollegeRoute);
router.use('/rewards', rewardRoutes);

module.exports = router;