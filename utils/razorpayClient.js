const Razorpay = require("razorpay");
const crypto = require("crypto");

// Initialize Razorpay only if credentials are available
let razorpay;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
} else {
    console.warn('RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not configured. Razorpay features will be disabled.');
}

const verifyRazorpaySignature = (orderId, paymentId, signature) => {
    if (!process.env.RAZORPAY_KEY_SECRET) {
        console.error('RAZORPAY_KEY_SECRET not configured');
        return false;
    }
    
    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const providedBuffer = Buffer.from(signature, "hex");

    if (expectedBuffer.length !== providedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
};

const verifyWebhookSignature = (rawBody, signature) => {
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
        console.error('RAZORPAY_WEBHOOK_SECRET not configured');
        return false;
    }
    
    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const providedBuffer = Buffer.from(signature, "hex");

    if (expectedBuffer.length !== providedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
};

module.exports = {
    razorpay,
    verifyRazorpaySignature,
    verifyWebhookSignature
};
