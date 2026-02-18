const College = require('../../models/college');
const User = require('../../models/user');
const { USER_TYPE } = require('../../constants/allConstant');
const cloudinary = require('../../middlewares/cloudinary/cloudinary');

const addCollege = async (req, res) => {
  try {
    const { name, code, email, phone, address, website } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: "College name and code are required"
      });
    }

    const existingCollege = await College.findOne({
      $or: [{ name }, { code }]
    });

    if (existingCollege) {
      return res.status(409).json({
        success: false,
        message: "College already exists"
      });
    }

    let logo = null;
    if (req.files?.logo) {
      logo = {
        url: req.files.logo[0].path,
        public_id: req.files.logo[0].filename,
      };
    }

    console.log('our api is here.....')

    let banners = [];
    if (req.files?.banners) {
      banners = req.files.banners.map(file => ({
        url: file.path,
        public_id: file.filename
      }));
    }

    const college = await College.create({
      name,
      code,
      email,
      phone,
      address,
      website,
      logo,
      banners,
      createdBy: req.user.id
    });

    return res.status(201).json({
      success: true,
      message: "College added successfully",
      data: college
    });

  } catch (error) {
    console.error("Add College Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while adding college"
    });
  }
};

const getAllColleges = async (req, res) => {
  try {

    let { page = 1, limit = 10, search = "", tier, status } = req.query;

    page = Number(page);
    limit = Number(limit);

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } }
      ];
    }

    if (tier) {
      query["performance.tier"] = tier;
    }

    if (status) {
      query.status = status;
    }

    const colleges = await College.find(query)
      .populate("collegeLead", "fullName email phone")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await College.countDocuments(query);

    return res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: colleges
    });

  } catch (error) {
    console.error("Get All Colleges Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching colleges"
    });
  }
};


const updateCollege = async (req, res) => {
  try {
    const { collegeId } = req.params;

    const college = await College.findById(collegeId);
    if (!college) {
      return res.status(404).json({
        success: false,
        message: "College not found"
      });
    }

    const updates = req.body;

    if (updates.code && updates.code !== college.code) {
      const codeExists = await College.findOne({ code: updates.code });
      if (codeExists) {
        return res.status(409).json({
          success: false,
          message: "College code already in use"
        });
      }
    }

    if (req.files?.logo) {

      if (college.logo?.public_id) {
        await cloudinary.uploader.destroy(college.logo.public_id);
      }

      college.logo = {
        url: req.files.logo[0].path,
        public_id: req.files.logo[0].filename,
      };
    }

    if (req.files?.banners) {

      for (const banner of college.banners) {
        await cloudinary.uploader.destroy(banner.public_id);
      }

      college.banners = req.files.banners.map(file => ({
        url: file.path,
        public_id: file.filename
      }));
    }

    Object.assign(college, updates);
    await college.save();

    return res.status(200).json({
      success: true,
      message: "College updated successfully",
      data: college
    });

  } catch (error) {
    console.error("Update College Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating college"
    });
  }
};

const getCollegeByCode = async (req, res) => {
  try {

    const { collegeCode } = req.params;

    if (!collegeCode) {
      return res.status(400).json({
        success: false,
        message: "College code is required"
      });
    }

    const college = await College.findOne({
      code: collegeCode.toUpperCase()
    })
      .populate("collegeLead", "fullName email phone")
      .populate("admins", "fullName email")
      .populate("clubs", "name");

    if (!college) {
      return res.status(404).json({
        success: false,
        message: "College not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: college
    });

  } catch (error) {
    console.error("Get College By Code Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching college"
    });
  }
};


const getUsersByCollege = async (req, res) => {
  try {

    const { collegeId } = req.params;

    let { page = 1, limit = 50, search = "" } = req.query;

    page = Number(page);
    limit = Number(limit);

    const query = {
      "college.collegeId": collegeId,
      fullName: { $regex: search, $options: "i" }
    };

    const users = await User.find(query)
      .select("-password")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    return res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: users
    });

  } catch (error) {
    console.error("Get Users By College Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

const assignCollegeLead = async (req, res) => {
  try {
    const { collegeId, userId } = req.body;

    if (!collegeId || !userId) {
      return res.status(400).json({
        success: false,
        message: "collegeId and userId are required"
      });
    }

    const college = await College.findById(collegeId);
    if (!college) {
      return res.status(404).json({
        success: false,
        message: "College not found"
      });
    }

    if (college.collegeLead) {
      return res.status(409).json({
        success: false,
        message: "College already has a lead assigned"
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (user.role === USER_TYPE.COLLEGE_LEAD) {
      return res.status(409).json({
        success: false,
        message: "User is already a college lead"
      });
    }

    college.collegeLead = user._id;
    college.status = "ACTIVE";
    college.isVerified = true;
    college.verifiedBy = req.user.id;
    await college.save();

    user.role = USER_TYPE.COLLEGE_LEAD;
    user.college = {
      collegeId: college._id,
      collegeName: college.name,
      isVerified: true
    };
    user.isVerified = true;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "College Lead assigned successfully",
      data: {
        college: {
          id: college._id,
          name: college.name
        },
        collegeLead: {
          id: user._id,
          name: user.fullName,
          email: user.email
        }
      }
    });

  } catch (error) {
    console.error("Assign College Lead Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while assigning college lead"
    });
  }
};

module.exports = { addCollege, getAllColleges, updateCollege, getUsersByCollege, getCollegeByCode, assignCollegeLead };