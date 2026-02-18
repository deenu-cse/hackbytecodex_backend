const express = require("express");
const router = express.Router();
const judgeRoute = require("./judgeRoute");

router.use("/judges", judgeRoute);

module.exports = router;