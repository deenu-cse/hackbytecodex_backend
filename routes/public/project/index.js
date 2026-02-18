const express = require("express");
const router = express.Router();

router.use("/projects", require("./projectRoute"));

module.exports = router;