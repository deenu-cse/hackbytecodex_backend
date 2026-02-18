const express  = require('express');
const codexClubs = require('./clubRoute');
const router = express.Router();

console.log('codexAuth wala index.js')

router.use('/clubs', codexClubs);

module.exports = router;
