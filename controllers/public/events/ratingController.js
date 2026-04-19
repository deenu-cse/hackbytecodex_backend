const EventRating = require("../../../models/eventRating");
const Event = require("../../../models/event");
const User = require("../../../models/user");

// Rate an event
const rateEvent = async (req, res) => {
    try {
        const { eventId } = req.params;
        const { rating, review, isAnonymous = false } = req.body;
        const userId = req.user.id;

        // Validate rating
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: "Rating must be between 1 and 5"
            });
        }

        // Check if event exists
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        // Check if user has already rated this event
        const existingRating = await EventRating.findOne({ eventId, userId });

        let savedRating;
        if (existingRating) {
            // Update existing rating
            existingRating.rating = rating;
            existingRating.review = review;
            existingRating.isAnonymous = isAnonymous;
            savedRating = await existingRating.save();
        } else {
            // Create new rating
            savedRating = await EventRating.create({
                eventId,
                userId,
                rating,
                review,
                isAnonymous
            });
        }

        // Update event's average rating
        await updateEventAverageRating(eventId);

        res.status(200).json({
            success: true,
            message: existingRating ? "Rating updated successfully" : "Rating submitted successfully",
            data: {
                rating: savedRating.rating,
                review: savedRating.review,
                isAnonymous: savedRating.isAnonymous,
                createdAt: savedRating.createdAt,
                updatedAt: savedRating.updatedAt
            }
        });

    } catch (error) {
        console.error("Rate event error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Get user's rating for an event
const getUserRating = async (req, res) => {
    try {
        const { eventId } = req.params;
        const userId = req.user.id;

        const rating = await EventRating.findOne({ eventId, userId });

        if (!rating) {
            return res.status(200).json({
                success: true,
                data: null,
                message: "User has not rated this event"
            });
        }

        res.status(200).json({
            success: true,
            data: {
                rating: rating.rating,
                review: rating.review,
                isAnonymous: rating.isAnonymous,
                createdAt: rating.createdAt,
                updatedAt: rating.updatedAt
            }
        });

    } catch (error) {
        console.error("Get user rating error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Get all ratings for an event
const getEventRatings = async (req, res) => {
    try {
        const { eventId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.min(50, Number(limit));
        const skip = (pageNum - 1) * limitNum;

        // Check if event exists
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        const ratings = await EventRating.find({ eventId })
            .populate('userId', 'fullName avatar college')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        const total = await EventRating.countDocuments({ eventId });

        // Calculate average rating
        const ratingStats = await EventRating.aggregate([
            { $match: { eventId: event._id } },
            {
                $group: {
                    _id: null,
                    averageRating: { $avg: "$rating" },
                    totalRatings: { $sum: 1 },
                    ratingDistribution: {
                        $push: "$rating"
                    }
                }
            }
        ]);

        let stats = {
            averageRating: 0,
            totalRatings: 0,
            distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        };

        if (ratingStats.length > 0) {
            stats.averageRating = Math.round(ratingStats[0].averageRating * 10) / 10;
            stats.totalRatings = ratingStats[0].totalRatings;

            // Calculate distribution
            ratingStats[0].ratingDistribution.forEach(rating => {
                stats.distribution[rating] = (stats.distribution[rating] || 0) + 1;
            });
        }

        res.status(200).json({
            success: true,
            data: {
                ratings: ratings.map(r => ({
                    _id: r._id,
                    rating: r.rating,
                    review: r.review,
                    isAnonymous: r.isAnonymous,
                    createdAt: r.createdAt,
                    user: r.isAnonymous ? null : {
                        _id: r.userId._id,
                        fullName: r.userId.fullName,
                        avatar: r.userId.avatar,
                        college: r.userId.college
                    }
                })),
                stats,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.ceil(total / limitNum)
                }
            }
        });

    } catch (error) {
        console.error("Get event ratings error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Delete user's rating
const deleteUserRating = async (req, res) => {
    try {
        const { eventId } = req.params;
        const userId = req.user.id;

        const rating = await EventRating.findOneAndDelete({ eventId, userId });

        if (!rating) {
            return res.status(404).json({
                success: false,
                message: "Rating not found"
            });
        }

        // Update event's average rating
        await updateEventAverageRating(eventId);

        res.status(200).json({
            success: true,
            message: "Rating deleted successfully"
        });

    } catch (error) {
        console.error("Delete rating error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Helper function to update event's average rating
const updateEventAverageRating = async (eventId) => {
    try {
        const mongoose = require('mongoose');
        const ratingStats = await EventRating.aggregate([
            { $match: { eventId: new mongoose.Types.ObjectId(eventId) } },
            {
                $group: {
                    _id: null,
                    averageRating: { $avg: "$rating" },
                    totalRatings: { $sum: 1 }
                }
            }
        ]);

        const updateData = {
            'performance.rating': 0,
            'performance.score': 0
        };

        if (ratingStats.length > 0) {
            updateData['performance.rating'] = Math.round(ratingStats[0].averageRating * 10) / 10;
            // You can adjust the score calculation logic as needed
            updateData['performance.score'] = Math.min(100, ratingStats[0].totalRatings * 5 + ratingStats[0].averageRating * 10);
        }

        await Event.findByIdAndUpdate(eventId, updateData);
    } catch (error) {
        console.error("Update event average rating error:", error);
    }
};

module.exports = {
    rateEvent,
    getUserRating,
    getEventRatings,
    deleteUserRating
};