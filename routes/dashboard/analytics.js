const express = require('express');
const { 
    getSuperAdminDashboard, 
    getCollegeLeadDashboard, 
    getClubAdminDashboard, 
    getStudentDashboard 
} = require('../../controllers/dashboard/analyticsController');
const { verifyToken } = require('../../middlewares/authMiddlewares/verifyToken');
const { USER_TYPE } = require('../../constants/allConstant');

const router = express.Router();

// Super Admin Dashboard
router.get(
    '/superadmin',
    verifyToken([USER_TYPE.SUPER_ADMIN]),
    getSuperAdminDashboard
);

// College Lead Dashboard
router.get(
    '/college-lead',
    verifyToken([USER_TYPE.COLLEGE_LEAD]),
    getCollegeLeadDashboard
);

// Club Admin Dashboard
router.get(
    '/club-admin',
    verifyToken([USER_TYPE.CLUB_ADMIN]),
    getClubAdminDashboard
);

// Student Dashboard
router.get(
    '/student',
    verifyToken([USER_TYPE.STUDENT]),
    getStudentDashboard
);

module.exports = router;
