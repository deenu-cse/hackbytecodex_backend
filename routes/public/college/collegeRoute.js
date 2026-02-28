const express = require("express");
const router = express.Router();

const {
    getAllColleges,
    getCollegeById,
    getCollegeByName,
    getClubsByCollegeName,
    getCollegeLeaderboard,
    getCollegeFilterOptions,
    getClubDetailByCollege
} = require("../../../controllers/public/college/collegeController");

router.get("/filters/options", getCollegeFilterOptions);

router.get("/leaderboard", getCollegeLeaderboard);

router.get("/", getAllColleges);

router.get("/id/:collegeId", getCollegeById);

router.get("/name/:collegeName", getCollegeByName);

router.get("/name/:collegeName/clubs", getClubsByCollegeName);

router.get("/name/:collegeName/clubs/:clubCode", getClubDetailByCollege);

module.exports = router;
