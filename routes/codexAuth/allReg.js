const express = require('express');
const { codexReg, getMe, login, getAllColleges } = require('../../controllers/codexAuth/allAuth');
const router = express.Router();
const { verifyToken } = require('../../middlewares/authMiddlewares/verifyToken')
const sendEmail = require('../../utils/sendEmail')

console.log('allReg.js')


router.post('/register', codexReg);

router.post('/login', login);

router.get("/colleges", getAllColleges);

router.get('/me', verifyToken(), getMe);

router.post('/colleges/request', async (req, res) => {
    try {

        const { collegeName } = req.body;

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
            message: "Request submitted"
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

module.exports = router;