const User = require("../../models/user");
const sendEmail = require("../../utils/sendEmail");

// Send email to users
const sendEmailToUsers = async (req, res) => {
    try {
        const { userIds, userType, subject, message, htmlContent } = req.body;

        if (!subject || !message) {
            return res.status(400).json({
                success: false,
                message: "Subject and message are required"
            });
        }

        // Build query based on userType
        let query = {};

        if (userType === "ALL") {
            // Send to all users
            query = {};
        } else if (userType === "COLLEGE_LEAD") {
            // Send to college leads
            query.role = "COLLEGE_LEAD";
        } else if (userType === "NO_COLLEGE") {
            // Send to users who haven't added college yet
            query.$or = [
                { "college.collegeId": { $exists: false } },
                { "college.collegeId": null },
                { "college.isVerified": false }
            ];
        } else if (userType === "STUDENT") {
            query.role = "STUDENT";
        } else if (userType === "MENTOR") {
            query.role = "MENTOR";
        } else if (userType === "CLUB_ADMIN") {
            query.role = "CLUB_ADMIN";
        }

        // If specific userIds are provided, use those instead
        if (userIds && userIds.length > 0) {
            query._id = { $in: userIds };
        }

        // Get users
        const users = await User.find(query).select('email fullName');

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No users found matching the criteria"
            });
        }

        // Send emails in batches to avoid rate limits
        const batchSize = 50;
        const emailPromises = [];
        const results = {
            total: users.length,
            sent: 0,
            failed: 0,
            errors: []
        };

        for (let i = 0; i < users.length; i += batchSize) {
            const batch = users.slice(i, i + batchSize);

            const batchPromises = batch.map(async (user) => {
                try {
                    const emailData = {
                        to: user.email,
                        subject: subject,
                        template: "adminEmail", // We'll create this template
                        data: {
                            recipientName: user.fullName,
                            subject: subject,
                            message: message,
                            htmlContent: htmlContent || null
                        }
                    };

                    await sendEmail(emailData);
                    results.sent++;
                    return { email: user.email, status: "sent" };
                } catch (error) {
                    console.error(`Failed to send email to ${user.email}:`, error);
                    results.failed++;
                    results.errors.push({
                        email: user.email,
                        error: error.message
                    });
                    return { email: user.email, status: "failed", error: error.message };
                }
            });

            // Wait for each batch to complete before starting the next
            const batchResults = await Promise.allSettled(batchPromises);
            emailPromises.push(...batchResults);

            // Small delay between batches to avoid overwhelming the email service
            if (i + batchSize < users.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        res.status(200).json({
            success: true,
            message: `Email sending completed. Sent: ${results.sent}, Failed: ${results.failed}`,
            data: {
                total: results.total,
                sent: results.sent,
                failed: results.failed,
                errors: results.errors.slice(0, 10) // Limit error details
            }
        });

    } catch (error) {
        console.error("Send email to users error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Get email statistics
const getEmailStats = async (req, res) => {
    try {
        const stats = await User.aggregate([
            {
                $group: {
                    _id: "$role",
                    count: { $sum: 1 }
                }
            }
        ]);

        const totalUsers = await User.countDocuments();
        const verifiedUsers = await User.countDocuments({ isVerified: true });
        const unverifiedUsers = totalUsers - verifiedUsers;

        const noCollegeUsers = await User.countDocuments({
            $or: [
                { "college.collegeId": { $exists: false } },
                { "college.collegeId": null },
                { "college.isVerified": false }
            ]
        });

        res.status(200).json({
            success: true,
            data: {
                total: totalUsers,
                verified: verifiedUsers,
                unverified: unverifiedUsers,
                noCollege: noCollegeUsers,
                byRole: stats.reduce((acc, stat) => {
                    acc[stat._id] = stat.count;
                    return acc;
                }, {})
            }
        });

    } catch (error) {
        console.error("Get email stats error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

module.exports = {
    sendEmailToUsers,
    getEmailStats
};