const express = require('express');
const { sendEmailToUsers, getEmailStats } = require('../../controllers/admins/emailController');
const { verifyToken } = require('../../middlewares/authMiddlewares/verifyToken');
const { USER_TYPE } = require('../../constants/allConstant');
const router = express.Router();

// All routes require super admin access
router.use(verifyToken([USER_TYPE.SUPER_ADMIN]));

// Send email to users
router.post('/send', sendEmailToUsers);

// Get email statistics
router.get('/stats', getEmailStats);

module.exports = router;