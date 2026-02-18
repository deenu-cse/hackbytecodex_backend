const express  = require('express');
const codexAllAuth = require('./codexAuth')
const collageRoutes = require('./admins')
const clubRoutes = require('./clubs')
const collegeLead = require('./collegeLead')
const publicRoutes = require('./public/events')
const projectRoutes = require('./public/project')
const judgeRoutes = require('./judge')
const router = express.Router();

console.log('route wala index.js')

router.use('/', codexAllAuth);
router.use('/admin', collageRoutes);
router.use('/', clubRoutes)
router.use('/', collegeLead)
router.use('/user', publicRoutes)
router.use('/', judgeRoutes);
router.use('/', projectRoutes);

module.exports = router;