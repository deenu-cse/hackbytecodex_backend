const EventPlatformUser = require("../../models/api/EventPlatformUser");

const updateSettings = async (req, res) => {
  try {
    const platformUserId = req.platformUser.id;
    const { settings } = req.body;

    // Validate settings object
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        message: "Settings object is required"
      });
    }

    // Update platform user settings
    const updatedUser = await EventPlatformUser.findByIdAndUpdate(
      platformUserId,
      { 
        $set: { 
          settings: {
            ...req.platformUser.settings,
            ...settings
          }
        }
      },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "Platform user not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: updatedUser
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to update settings",
      error: err.message
    });
  }
};

const getSettings = async (req, res) => {
  try {
    const platformUserId = req.platformUser.id;

    const platformUser = await EventPlatformUser.findById(platformUserId);

    if (!platformUser) {
      return res.status(404).json({
        success: false,
        message: "Platform user not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: platformUser.settings
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch settings",
      error: err.message
    });
  }
};

module.exports = {
  updateSettings,
  getSettings
};