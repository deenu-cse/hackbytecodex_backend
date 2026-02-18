const bcrypt = require('bcryptjs');
const User = require('../../models/user')
const { USER_TYPE } = require('../../constants/allConstant');
const { createToken } = require('../../middlewares/authMiddlewares/createToken');
const College = require('../../models/college');

const codexReg = async (req, res) => {
    try {
        const {
            fullName,
            email,
            password,
            phone,
            college
        } = req.body;

        const role = USER_TYPE.STUDENT;

        console.log('bodyyy', req.body)

        if (!fullName || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Full name, email and password are required"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters long"
            });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "User already registered with this email"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const safeRole = Object.values(USER_TYPE).includes(role)
            ? role
            : USER_TYPE.STUDENT;

        const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
            fullName
        )}`;

        const user = await User.create({
            fullName,
            email,
            phone,
            avatar,
            password: hashedPassword,
            role: safeRole,
            college: college || {},
            isVerified: safeRole === USER_TYPE.STUDENT ? true : false
        });

        const token = createToken(user);

        return res.status(201).json({
            success: true,
            message: "Registration successful",
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                rewards: user.rewards,
                performance: user.performance
            }
        });

    } catch (error) {
        console.error("Register Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

const login = async (req, res) => {
    try {

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        // get password also
        const user = await User.findOne({ email }).select("+password");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        if (user.status !== "ACTIVE") {
            return res.status(403).json({
                success: false,
                message: "Your account is not active"
            });
        }

        const isMatch = bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        // update last login
        user.lastLogin = new Date();
        await user.save();

        const token = createToken(user);

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                rewards: user.rewards,
                performance: user.performance,
                college: user.college
            }
        });

    } catch (error) {
        console.error("Login Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error during login"
        });
    }
};

const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate("college.collegeId", "name logo location")
            .populate("clubs.clubId", "name logo");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: user
        });

    } catch (error) {

        console.error("Get Me Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

const getAllColleges = async (req, res) => {
    try {
        let {
            page = 1,
            limit = 10,
            search,
            status,
            tier,
            verified,
            sortBy = "createdAt",
            order = "desc",
            fields
        } = req.query;

        page = parseInt(page);
        limit = Math.min(parseInt(limit), 50);

        const skip = (page - 1) * limit;

        const filter = {};

        if (status) filter.status = status;
        if (tier) filter["performance.tier"] = tier;
        if (verified !== undefined)
            filter.isVerified = verified === "true";

        if (search) {
            filter.$text = {
                $search: search
            };
        }

        const sort = {
            [sortBy]: order === "asc" ? 1 : -1
        };

        let selectFields = "";

        if (fields) {
            selectFields = fields.split(",").join(" ");
        } else {
            selectFields =
                "name code logo address.city performance.rating performance.tier stats.eventsHosted status isVerified";
        }

        const [colleges, total] = await Promise.all([

            College.find(filter)
                .select(selectFields)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),

            College.countDocuments(filter)

        ]);

        res.json({
            success: true,
            data: colleges,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit
            }
        });

    } catch (error) {
        console.error("Get Colleges Error:", error);
        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
};


module.exports = { codexReg, login, getMe, getAllColleges }