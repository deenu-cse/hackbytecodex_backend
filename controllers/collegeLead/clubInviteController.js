const Club = require("../../models/club");
const { USER_TYPE } = require("../../constants/allConstant");

const generateClubInviteLink = async (req, res) => {
  try {
    const user = req.user;
    const { clubId } = req.params;

    if (user.role !== USER_TYPE.COLLEGE_LEAD) {
      return res.status(403).json({
        success: false,
        message: "Only College Lead can generate invite link"
      });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({
        success: false,
        message: "Club not found"
      });
    }

    // 🔐 ownership check
    if (club.college.collegeId.toString() !== user.college.collegeId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized club access"
      });
    }

    const inviteLink = `${process.env.FRONTEND_URL}/club/join/${club.code}`;

    return res.status(200).json({
      success: true,
      inviteLink,
      clubCode: club.code
    });

  } catch (error) {
    console.error("Generate Club Invite Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while generating invite link"
    });
  }
};

module.exports = { generateClubInviteLink };
