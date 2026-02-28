const express = require("express");
const router = express.Router();

const collegeRoutes = require("./collegeRoute");

router.use("/colleges", collegeRoutes);

module.exports = router;
