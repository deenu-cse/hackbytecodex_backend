const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddlewares/verifyToken");
const {
    createOrder,
    verifyPayment,
    getSubscription,
    cancelSubscription,
    rotateApiKey,
    handleWebhook
} = require("../../controllers/apiPlatform/billingController");
const { verifyPlatformToken } = require("../../middlewares/apiPlatform/verifyPlatformToken");

router.post("/create-order", verifyToken(), createOrder);
router.post("/verify-payment", verifyToken(), verifyPayment);
router.get("/subscription", verifyToken(), getSubscription);

router.post("/cancel", verifyPlatformToken, cancelSubscription);
router.post("/rotate-key", verifyPlatformToken, rotateApiKey);

router.post("/webhook", handleWebhook);

module.exports = router;
