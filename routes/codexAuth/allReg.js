const express = require('express');
const { codexReg, getMe, login, getAllColleges, getAllUsers } = require('../../controllers/codexAuth/allAuth');
const router = express.Router();
const { verifyToken } = require('../../middlewares/authMiddlewares/verifyToken')
const sendEmail = require('../../utils/sendEmail')
const { USER_TYPE } = require('../../constants/allConstant')

console.log('allReg.js')


router.post('/register', codexReg);

router.post('/login', login);

router.get("/colleges", getAllColleges);

router.get('/me', verifyToken(), getMe);

router.get(
    '/users',
    verifyToken([USER_TYPE.SUPER_ADMIN]),
    getAllUsers
);

router.post('/colleges/request', async (req, res) => {
    try {
        const { collegeName } = req.body;

        if (!collegeName || !collegeName.trim()) {
            return res.status(400).json({
                success: false,
                message: "College name is required"
            });
        }

        // Check if sendEmail is properly configured
        if (!sendEmail) {
            console.error('sendEmail function is not available');
            return res.status(500).json({
                success: false,
                message: "Email service not configured"
            });
        }

        await sendEmail({
            to: "vdeendayal866@gmail.com",
            subject: "New College Request - Codex",
            template: "collegeRequest",
            data: {
                collegeName,
                requestedAt: new Date(),
            }
        });

        res.json({
            success: true,
            message: "Request submitted successfully"
        });

    } catch (err) {
        console.error('College request error:', err);
        console.error('Error stack:', err.stack);
        res.status(500).json({ 
            success: false,
            message: err.message || "Failed to submit request",
            error: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

module.exports = router;