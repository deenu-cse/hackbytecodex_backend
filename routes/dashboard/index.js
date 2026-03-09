const express = require('express');
const analyticsRoutes = require('./analytics');

const router = express.Router();

router.use('/analytics', analyticsRoutes);

module.exports = router;
