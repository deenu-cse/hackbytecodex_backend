const express = require('express');
const { addCollege, updateCollege, assignCollegeLead, getUsersByCollege, getAllColleges, getCollegeByCode } = require('../../controllers/admin/collegeController');
const { verifyToken } = require('../../middlewares/authMiddlewares/verifyToken');
const { USER_TYPE } = require('../../constants/allConstant');
const uploadCollegeMedia = require('../../middlewares/cloudinary/uploadCollegeMedia');

const router = express.Router();

router.post(
    '/addCollage',
    verifyToken([USER_TYPE.SUPER_ADMIN]),
    uploadCollegeMedia,
    addCollege
);

router.get(
    '/',
    verifyToken([USER_TYPE.SUPER_ADMIN]),
    getAllColleges
);

router.put(
    '/updateCollege/:collegeId',
    verifyToken([USER_TYPE.SUPER_ADMIN]),
    uploadCollegeMedia,
    updateCollege
);

router.get(
  '/code/:collegeCode',
  verifyToken([USER_TYPE.SUPER_ADMIN, USER_TYPE.COLLEGE_LEAD, USER_TYPE.STUDENT]),
  getCollegeByCode
);


router.get(
    '/:collegeId/users',
    verifyToken([USER_TYPE.SUPER_ADMIN, USER_TYPE.COLLEGE_LEAD]),
    getUsersByCollege
);

router.post(
    '/assignCollegeLead',
    verifyToken([USER_TYPE.SUPER_ADMIN]),
    assignCollegeLead
);

module.exports = router;
