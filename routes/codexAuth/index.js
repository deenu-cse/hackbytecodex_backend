const express  = require('express');
const codexReg = require('./allReg');
const router = express.Router();

console.log('codexAuth wala index.js')

router.use('/auth', codexReg);

module.exports = router;
