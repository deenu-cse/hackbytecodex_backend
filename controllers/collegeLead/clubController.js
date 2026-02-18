const Club = require("../../models/club");
const College = require("../../models/college");
const { USER_TYPE } = require("../../constants/allConstant");

const addClub = async (req, res) => {
  try {
    const user = req.user;

    if (user.role !== USER_TYPE.COLLEGE_LEAD) {
      return res.status(403).json({
        success: false,
        message: "Only College Lead can create clubs"
      });
    }

    // console.log("USER =", user);

    const { name, code, description, collegeId } = req.body;

    const logo = req.files?.logo?.[0]
      ? {
        url: req.files.logo[0].path,
        public_id: req.files.logo[0].filename
      }
      : null;

    const banners =
      req.files?.banners?.map(file => ({
        url: file.path,
        public_id: file.filename
      })) || [];

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: "Club name and code are required"
      });
    }

    const college = await College.findById(collegeId);

    if (!college) {
      return res.status(404).json({
        success: false,
        message: "College not found"
      });
    }

    const existingClub = await Club.findOne({ code });

    if (existingClub) {
      return res.status(409).json({
        success: false,
        message: "Club code already exists"
      });
    }

    const club = await Club.create({
      name,
      code,
      description,
      logo,
      banners,
      college: {
        collegeId: college._id,
        collegeName: college.name
      },
      admins: [user.id],
      members: [user.id]
    });

    college.clubs.push(club._id);
    college.stats.clubsCount += 1;
    await college.save();

    return res.status(201).json({
      success: true,
      message: "Club created successfully",
      data: club
    });

  } catch (error) {
    console.log(JSON.stringify(error, null, 2));

    return res.status(500).json({
      success: false,
      message: "Server error while creating club"
    });
  }
};

module.exports = { addClub };