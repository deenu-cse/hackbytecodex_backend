const express  = require('express');
const codexAllAuth = require('./codexAuth')
const collageRoutes = require('./admins')
const clubRoutes = require('./clubs')
const collegeLead = require('./collegeLead')
const publicRoutes = require('./public/events')
const projectRoutes = require('./public/project')
const collegePublicRoutes = require('./public/college')
const judgeRoutes = require('./judge')
const apiPlatformRoutes = require('./apiPlatform')
const router = express.Router();

console.log('route wala index.js')

router.use('/', codexAllAuth);
router.use('/admin', collageRoutes);
router.use('/', clubRoutes)
router.use('/', collegeLead)
router.use('/user', publicRoutes)
router.use('/', judgeRoutes);
router.use('/', projectRoutes);
router.use('/public', collegePublicRoutes);
router.use('/api-platform', apiPlatformRoutes);

module.exports = router;