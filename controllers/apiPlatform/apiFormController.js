const ApiEventForm = require("../../models/api/ApiEventForm");
const ApiEvent = require("../../models/api/ApiEvent");

const createForm = async (req, res) => {
    try {
        const { eventId } = req.params;
        const platformUserId = req.platformUser.id;

        const event = await ApiEvent.findOne({
            _id: eventId,
            platformUser: platformUserId
        });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        const existingForm = await ApiEventForm.findOne({ event: eventId });
        if (existingForm) {
            return res.status(409).json({
                success: false,
                message: "A form already exists for this event. Use PUT to update."
            });
        }

        const { fields, allowTeams, teamSize } = req.body;

        if (!fields || !Array.isArray(fields) || fields.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one form field is required"
            });
        }

        const form = new ApiEventForm({
            event: eventId,
            platformUser: platformUserId,
            fields,
            allowTeams: allowTeams || false,
            teamSize: teamSize || { min: 1, max: 4 }
        });

        await form.save();

        event.form = form._id;
        await event.save();

        return res.status(201).json({
            success: true,
            message: "Event form created successfully",
            data: form
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to create form",
            error: err.message
        });
    }
};

const getForm = async (req, res) => {
    try {
        const { eventId } = req.params;
        const platformUserId = req.platformUser.id;

        const event = await ApiEvent.findOne({
            _id: eventId,
            platformUser: platformUserId
        });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        const form = await ApiEventForm.findOne({ event: eventId });

        if (!form) {
            return res.status(404).json({
                success: false,
                message: "No form found for this event"
            });
        }

        return res.status(200).json({
            success: true,
            data: form
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch form",
            error: err.message
        });
    }
};

const updateForm = async (req, res) => {
    try {
        const { eventId } = req.params;
        const platformUserId = req.platformUser.id;

        const event = await ApiEvent.findOne({
            _id: eventId,
            platformUser: platformUserId
        });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        const form = await ApiEventForm.findOne({ event: eventId });

        if (!form) {
            return res.status(404).json({
                success: false,
                message: "No form found for this event. Create one first."
            });
        }

        const { fields, allowTeams, teamSize } = req.body;

        if (fields !== undefined) {
            if (!Array.isArray(fields) || fields.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Fields must be a non-empty array"
                });
            }
            form.fields = fields;
        }
        if (allowTeams !== undefined) form.allowTeams = allowTeams;
        if (teamSize !== undefined) form.teamSize = teamSize;

        await form.save();

        return res.status(200).json({
            success: true,
            message: "Form updated successfully",
            data: form
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to update form",
            error: err.message
        });
    }
};

const deleteForm = async (req, res) => {
    try {
        const { eventId } = req.params;
        const platformUserId = req.platformUser.id;

        const event = await ApiEvent.findOne({
            _id: eventId,
            platformUser: platformUserId
        });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        const form = await ApiEventForm.findOneAndDelete({ event: eventId });

        if (!form) {
            return res.status(404).json({
                success: false,
                message: "No form found for this event"
            });
        }

        event.form = null;
        await event.save();

        return res.status(200).json({
            success: true,
            message: "Form deleted successfully"
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to delete form",
            error: err.message
        });
    }
};

module.exports = {
    createForm,
    getForm,
    updateForm,
    deleteForm
};
