const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { JWT, USER_TYPE } = require("../../constants/allConstant");
const EventPlatformUser = require("../../models/api/EventPlatformUser");
const Subscription = require("../../models/api/Subscription");
const sendEmail = require("../../utils/sendEmail");

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const platformUser = await EventPlatformUser.findOne({
            email: email.toLowerCase().trim()
        }).select("+password");

        if (!platformUser) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        if (platformUser.status === "EXPIRED") {
            return res.status(403).json({
                success: false,
                message: "Account expired. Please renew your subscription."
            });
        }

        const isMatch = await bcrypt.compare(password, platformUser.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const token = jwt.sign(
            {
                userId: platformUser._id,
                email: platformUser.email,
                role: USER_TYPE.EVENT_PLATFORM_USER,
                platformId: platformUser.platformId
            },
            JWT.EPU_SECRET,
            { expiresIn: JWT.EPU_EXPIRE_IN }
        );

        platformUser.lastLogin = new Date();
        await platformUser.save();

        const subscription = await Subscription.findById(platformUser.subscription);

        return res.status(200).json({
            success: true,
            data: {
                token,
                platformUser: {
                    id: platformUser._id,
                    platformId: platformUser.platformId,
                    email: platformUser.email,
                    fullName: platformUser.fullName,
                    avatar: platformUser.avatar,
                    status: platformUser.status,
                    plan: subscription?.plan || null,
                    subscriptionStatus: subscription?.status || null
                }
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Login failed",
            error: err.message
        });
    }
};

const getMe = async (req, res) => {
    try {
        const platformUser = await EventPlatformUser.findById(req.platformUser.id)
            .populate("subscription")
            .populate("apiKey", "jti tier status expiresAt lastUsedAt usageCount");

        if (!platformUser) {
            return res.status(404).json({
                success: false,
                message: "Platform user not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: platformUser
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch profile",
            error: err.message
        });
    }
};

const changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Old password and new password are required"
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 6 characters"
            });
        }

        const platformUser = await EventPlatformUser.findById(
            req.platformUser.id
        ).select("+password");

        if (!platformUser) {
            return res.status(404).json({
                success: false,
                message: "Platform user not found"
            });
        }

        const isMatch = await bcrypt.compare(oldPassword, platformUser.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Old password is incorrect"
            });
        }

        platformUser.password = await bcrypt.hash(newPassword, 10);
        await platformUser.save();

        return res.status(200).json({
            success: true,
            message: "Password changed successfully"
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to change password",
            error: err.message
        });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const platformUser = await EventPlatformUser.findOne({
            email: email.toLowerCase().trim()
        });

        if (!platformUser) {
            return res.status(200).json({
                success: true,
                message: "If an account exists with this email, a reset link has been sent."
            });
        }

        const resetToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = await bcrypt.hash(resetToken, 10);

        platformUser.passwordResetToken = hashedToken;
        platformUser.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
        await EventPlatformUser.findByIdAndUpdate(platformUser._id, {
            passwordResetToken: hashedToken,
            passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000)
        });

        const resetUrl = `${process.env.PLATFORM_DASHBOARD_URL || "https://platform.hackbytecodex.com"}/reset-password?token=${resetToken}&email=${encodeURIComponent(platformUser.email)}`;

        sendEmail({
            to: platformUser.email,
            subject: "Reset Your Event Platform Password",
            template: "platformPasswordReset",
            data: {
                fullName: platformUser.fullName,
                resetUrl,
                expiresIn: "1 hour"
            }
        }).catch((err) => console.error("Reset email failed:", err));

        return res.status(200).json({
            success: true,
            message: "If an account exists with this email, a reset link has been sent."
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to process password reset",
            error: err.message
        });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { email, token, newPassword } = req.body;

        if (!email || !token || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Email, token, and new password are required"
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 6 characters"
            });
        }

        const platformUser = await EventPlatformUser.findOne({
            email: email.toLowerCase().trim()
        }).select("+passwordResetToken +passwordResetExpires");

        if (!platformUser || !platformUser.passwordResetToken) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired reset token"
            });
        }

        if (platformUser.passwordResetExpires < new Date()) {
            return res.status(400).json({
                success: false,
                message: "Reset token has expired. Please request a new one."
            });
        }

        const isValid = await bcrypt.compare(token, platformUser.passwordResetToken);
        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: "Invalid reset token"
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await EventPlatformUser.findByIdAndUpdate(platformUser._id, {
            password: hashedPassword,
            passwordResetToken: null,
            passwordResetExpires: null
        });

        return res.status(200).json({
            success: true,
            message: "Password reset successfully. You can now login with your new password."
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to reset password",
            error: err.message
        });
    }
};

module.exports = {
    login,
    getMe,
    changePassword,
    forgotPassword,
    resetPassword
};
