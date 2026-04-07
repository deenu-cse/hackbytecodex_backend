const College = require('../../models/college');
const Club = require('../../models/club');
const User = require('../../models/user');
const { getRewardTierByPoints, USER_TYPE } = require('../../constants/allConstant');

// Award points to a college
const awardCollegePoints = async (req, res) => {
  try {
    const { collegeId } = req.params;
    const { points, title, reason } = req.body;

    if (!points || !title) {
      return res.status(400).json({
        success: false,
        message: "Points and title are required"
      });
    }

    const college = await College.findById(collegeId);
    if (!college) {
      return res.status(404).json({
        success: false,
        message: "College not found"
      });
    }

    // If college lead, verify they own this college
    if (req.user.role === USER_TYPE.COLLEGE_LEAD) {
      const user = await User.findById(req.user.id);
      if (user.college?.collegeId?.toString() !== collegeId) {
        return res.status(403).json({
          success: false,
          message: "You can only award points to your own college"
        });
      }
    }

    const newPoints = (college.rewards?.points || 0) + Number(points);
    const newTier = getRewardTierByPoints(newPoints);

    await College.findByIdAndUpdate(collegeId, {
      $inc: { "rewards.points": Number(points) },
      $push: {
        "rewards.history": {
          title,
          points: Number(points),
          reason: reason || "",
          date: new Date()
        }
      },
      $set: { "performance.tier": newTier }
    });

    return res.status(200).json({
      success: true,
      message: `${points} points awarded to college`,
      data: {
        totalPoints: newPoints,
        tier: newTier
      }
    });

  } catch (error) {
    console.error("Award College Points Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while awarding points"
    });
  }
};

// Award points to a club
const awardClubPoints = async (req, res) => {
  try {
    const { clubId } = req.params;
    const { points, title, reason } = req.body;

    if (!points || !title) {
      return res.status(400).json({
        success: false,
        message: "Points and title are required"
      });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({
        success: false,
        message: "Club not found"
      });
    }

    // If college lead, verify this club belongs to their college
    if (req.user.role === USER_TYPE.COLLEGE_LEAD) {
      const user = await User.findById(req.user.id);
      if (club.college?.collegeId?.toString() !== user.college?.collegeId?.toString()) {
        return res.status(403).json({
          success: false,
          message: "You can only award points to clubs in your college"
        });
      }
    }

    const newPoints = (club.rewards?.points || 0) + Number(points);
    const newTier = getRewardTierByPoints(newPoints);

    await Club.findByIdAndUpdate(clubId, {
      $inc: { "rewards.points": Number(points) },
      $push: {
        "rewards.history": {
          title,
          points: Number(points),
          reason: reason || "",
          date: new Date()
        }
      },
      $set: { "performance.tier": newTier }
    });

    return res.status(200).json({
      success: true,
      message: `${points} points awarded to club`,
      data: {
        totalPoints: newPoints,
        tier: newTier
      }
    });

  } catch (error) {
    console.error("Award Club Points Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while awarding points"
    });
  }
};

// Award points to a user
const awardUserPoints = async (req, res) => {
  try {
    const { userId } = req.params;
    const { points, title, description } = req.body;

    if (!points || !title) {
      return res.status(400).json({
        success: false,
        message: "Points and title are required"
      });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // If college lead, verify user belongs to their college
    if (req.user.role === USER_TYPE.COLLEGE_LEAD) {
      const reqUser = await User.findById(req.user.id);
      if (targetUser.college?.collegeId?.toString() !== reqUser.college?.collegeId?.toString()) {
        return res.status(403).json({
          success: false,
          message: "You can only award points to users in your college"
        });
      }
    }

    const newPoints = (targetUser.rewards?.points || 0) + Number(points);
    const newTier = getRewardTierByPoints(newPoints);

    await User.findByIdAndUpdate(userId, {
      $inc: { "rewards.points": Number(points) },
      $push: {
        "rewards.rewardHistory": {
          title,
          description: description || "",
          date: new Date()
        }
      },
      $set: { "rewards.tier": newTier }
    });

    return res.status(200).json({
      success: true,
      message: `${points} points awarded to user`,
      data: {
        totalPoints: newPoints,
        tier: newTier
      }
    });

  } catch (error) {
    console.error("Award User Points Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while awarding points"
    });
  }
};

module.exports = { awardCollegePoints, awardClubPoints, awardUserPoints };
