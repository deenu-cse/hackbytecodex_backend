const express = require("express");
const router = express.Router();
const {
    login,
    getMe,
    changePassword,
    forgotPassword,
    resetPassword
} = require("../../controllers/apiPlatform/platformAuthController");
const { verifyPlatformToken } = require("../../middlewares/apiPlatform/verifyPlatformToken");

router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

router.get("/me", verifyPlatformToken, getMe);
router.put("/change-password", verifyPlatformToken, changePassword);

module.exports = router;
