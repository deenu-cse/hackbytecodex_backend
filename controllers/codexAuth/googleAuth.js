const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../../models/user');
const { createToken } = require('../../middlewares/authMiddlewares/createToken');
const sendEmail = require('../../utils/sendEmail');

// Create OAuth client lazily so env vars are always read fresh
const getOAuthClient = () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
        throw new Error(
            `Google OAuth not configured. Missing: ${[
                !clientId && 'GOOGLE_CLIENT_ID',
                !clientSecret && 'GOOGLE_CLIENT_SECRET',
                !redirectUri && 'GOOGLE_REDIRECT_URI'
            ].filter(Boolean).join(', ')}`
        );
    }

    return new OAuth2Client(clientId, clientSecret, redirectUri);
};

const getFrontendUrl = () => process.env.FRONTEND_URL || 'https://hackbytecodex.com';

/**
 * Generate Google OAuth URL and redirect
 * GET /auth/google
 */
const googleLogin = (req, res) => {
    try {
        const oauthClient = getOAuthClient();
        const authUrl = oauthClient.generateAuthUrl({
            access_type: 'offline',
            scope: [
                'https://www.googleapis.com/auth/userinfo.profile',
                'https://www.googleapis.com/auth/userinfo.email'
            ],
            prompt: 'select_account'
        });

        res.redirect(authUrl);
    } catch (error) {
        console.error('Google Login Init Error:', error);
        res.redirect(`${getFrontendUrl()}/login?error=google_init_failed`);
    }
};

/**
 * Generate a secure random password (for temporary/fake password)
 */
const generateStrongPassword = () => {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const all = upper + lower + digits + special;

    let password = '';
    // Ensure at least one of each type
    password += upper[Math.floor(Math.random() * upper.length)];
    password += lower[Math.floor(Math.random() * lower.length)];
    password += digits[Math.floor(Math.random() * digits.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Fill remaining 12 characters
    for (let i = 0; i < 12; i++) {
        password += all[Math.floor(Math.random() * all.length)];
    }

    // Shuffle password
    return password.split('').sort(() => 0.5 - Math.random()).join('');
};

/**
 * Google OAuth Callback
 * GET /auth/google/callback
 */
const googleCallback = async (req, res) => {
    const FRONTEND_URL = getFrontendUrl();
    try {
        const { code, error } = req.query;

        if (error) {
            console.error('Google OAuth Error from provider:', error);
            return res.redirect(`${FRONTEND_URL}/login?error=google_denied`);
        }

        if (!code) {
            return res.redirect(`${FRONTEND_URL}/login?error=no_code`);
        }

        // Exchange auth code for access/refresh tokens
        const oauthClient = getOAuthClient();
        const { tokens } = await oauthClient.getToken(code);
        oauthClient.setCredentials(tokens);

        // Get user info from Google
        const userInfoResponse = await oauthClient.request({
            url: 'https://www.googleapis.com/oauth2/v2/userinfo'
        });

        const googleUser = userInfoResponse.data;
        const { id: googleId, email, name, picture } = googleUser;

        if (!email) {
            return res.redirect(`${FRONTEND_URL}/login?error=no_email`);
        }

        // Check if user exists by googleId or email
        let user = await User.findOne({
            $or: [{ googleId }, { email: email.toLowerCase() }]
        }).select('+passwordSetupToken +passwordSetupTokenExpiry');

        let isNewUser = false;

        if (!user) {
            // ===== NEW USER — Create with fake strong password =====
            isNewUser = true;

            const fakePassword = generateStrongPassword();
            const hashedPassword = await bcrypt.hash(fakePassword, 10);

            // Generate password setup token (valid 24 hours)
            const passwordSetupToken = crypto.randomBytes(32).toString('hex');
            const passwordSetupTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

            const avatar = picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;

            user = await User.create({
                fullName: name,
                email: email.toLowerCase(),
                avatar,
                password: hashedPassword,
                googleId,
                authProvider: 'google',
                hasSetPassword: false,
                passwordSetupToken,
                passwordSetupTokenExpiry,
                isVerified: true,
                role: 'STUDENT'
            });

            // Send welcome email with set-password link
            const setPasswordUrl = `${FRONTEND_URL}/set-password?token=${passwordSetupToken}&email=${encodeURIComponent(email)}`;

            sendEmail({
                to: user.email,
                subject: '🎉 Welcome to HackByteCodex — Set Your Password',
                template: 'googleWelcome',
                data: {
                    fullName: user.fullName,
                    email: user.email,
                    setPasswordUrl,
                    supportEmail: process.env.SUPPORT_EMAIL || 'support@hackbytecodex.com'
                }
            }).catch(err => console.error('Google Welcome Email Error:', err));

        } else {
            // ===== EXISTING USER — Link Google account if needed =====
            if (!user.googleId) {
                user.googleId = googleId;
                user.authProvider = 'google';
            }

            // Update avatar if not set
            if (!user.avatar && picture) {
                user.avatar = picture;
            }
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Build redirect URL
        if (isNewUser) {
            // New user: redirect to set-password page
            const setupToken = user.passwordSetupToken;
            const redirectUrl = `${FRONTEND_URL}/set-password?token=${setupToken}&email=${encodeURIComponent(email)}&welcome=1`;
            return res.redirect(redirectUrl);
        } else {
            // Existing user: generate JWT and redirect to home
            const token = createToken(user);
            return res.redirect(`${FRONTEND_URL}/?authToken=${token}&authSuccess=1`);
        }

    } catch (error) {
        console.error('Google Callback Error:', error);
        res.redirect(`${FRONTEND_URL}/login?error=google_failed`);
    }
};


/**
 * Set Password after Google Sign-in
 * POST /auth/set-password
 */
const setPassword = async (req, res) => {
    const FRONTEND_URL = getFrontendUrl();
    try {

        const { token, email, password, confirmPassword } = req.body;

        if (!token || !email || !password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Token, email, password, and confirm password are required'
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Password and confirm password do not match'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long'
            });
        }

        // Password strength check
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                success: false,
                message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
            });
        }

        const user = await User.findOne({
            email: email.toLowerCase()
        }).select('+passwordSetupToken +passwordSetupTokenExpiry');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (!user.passwordSetupToken || user.passwordSetupToken !== token) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired password setup link. Please sign in with Google again.'
            });
        }

        if (!user.passwordSetupTokenExpiry || user.passwordSetupTokenExpiry < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Password setup link has expired. Please sign in with Google to get a new link.'
            });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update user
        user.password = hashedPassword;
        user.hasSetPassword = true;
        user.passwordSetupToken = undefined;
        user.passwordSetupTokenExpiry = undefined;
        user.lastLogin = new Date();
        await user.save();

        // Send confirmation email
        sendEmail({
            to: user.email,
            subject: '✅ Your HackByteCodex Password Has Been Set',
            template: 'passwordSetSuccess',
            data: {
                fullName: user.fullName,
                email: user.email,
                loginUrl: `${FRONTEND_URL}/login`,
                supportEmail: process.env.SUPPORT_EMAIL || 'support@hackbytecodex.com'
            }
        }).catch(err => console.error('Password Set Success Email Error:', err));

        // Create JWT token to auto-login
        const authToken = createToken(user);

        return res.status(200).json({
            success: true,
            message: 'Password set successfully! You are now logged in.',
            token: authToken,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                rewards: user.rewards,
                performance: user.performance
            }
        });

    } catch (error) {
        console.error('Set Password Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Verify password setup token (for frontend to validate before showing form)
 * GET /auth/verify-setup-token?token=xxx&email=xxx
 */
const verifySetupToken = async (req, res) => {
    try {
        const { token, email } = req.query;

        if (!token || !email) {
            return res.status(400).json({ success: false, message: 'Token and email required' });
        }

        const user = await User.findOne({
            email: email.toLowerCase()
        }).select('+passwordSetupToken +passwordSetupTokenExpiry');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (!user.passwordSetupToken || user.passwordSetupToken !== token) {
            return res.status(400).json({ success: false, message: 'Invalid token' });
        }

        if (!user.passwordSetupTokenExpiry || user.passwordSetupTokenExpiry < new Date()) {
            return res.status(400).json({ success: false, message: 'Token expired' });
        }

        return res.status(200).json({
            success: true,
            message: 'Token valid',
            user: {
                fullName: user.fullName,
                email: user.email,
                avatar: user.avatar
            }
        });

    } catch (error) {
        console.error('Verify Setup Token Error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = { googleLogin, googleCallback, setPassword, verifySetupToken };
