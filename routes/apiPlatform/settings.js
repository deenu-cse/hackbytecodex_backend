const express = require("express");
const router = express.Router();
const { verifyPlatformToken } = require("../../middlewares/apiPlatform/verifyPlatformToken");
const { updateSettings, getSettings } = require("../../controllers/apiPlatform/apiSettingsController");

router.get("/settings", verifyPlatformToken, getSettings);
router.put("/settings", verifyPlatformToken, updateSettings);

module.exports = router;