const Project = require("../../../models/project");
const ProjectView = require("../../../models/projectView");
const ProjectLike = require("../../../models/projectLike");
const crypto = require("crypto");

const createProject = async (req, res) => {
    try {

        const userId = req.user.id;

        let {
            title,
            description,
            shortDescription,
            techStack,
            tags,
            links,
            github,
            live,
            status
        } = req.body;

        if (!title || !description) {
            return res.status(400).json({
                success: false,
                message: "Title & description required"
            });
        }

        const existing = await Project.findOne({
            owner: userId,
            title: title.trim()
        });

        if (existing) {
            return res.status(409).json({
                success: false,
                message: "You already uploaded a project with this title"
            });
        }

        try {
            if (typeof techStack === "string") techStack = JSON.parse(techStack);
            if (typeof tags === "string") tags = JSON.parse(tags);
            if (typeof links === "string") links = JSON.parse(links);
        } catch {
            return res.status(400).json({
                success: false,
                message: "Invalid JSON in techStack/tags/links"
            });
        }

        let coverImage = null;

        if (req.files?.cover?.length) {
            const file = req.files.cover[0];

            coverImage = {
                url: file.path,
                public_id: file.filename
            };
        }

        const images = req.files?.images?.length
            ? req.files.images.map(file => ({
                url: file.path,
                public_id: file.filename
            }))
            : [];

        const videos = req.files?.videos?.length
            ? req.files.videos.map(file => ({
                url: file.path,
                public_id: file.filename
            }))
            : [];

        const project = await Project.create({

            owner: userId,
            title: title.trim(),
            description,
            shortDescription,
            techStack,
            tags,
            links,
            github,
            live,
            status: status || "PUBLISHED",

            coverImage,
            images,
            videos
        });

        return res.status(201).json({
            success: true,
            message: "Project uploaded successfully",
            data: project
        });

    } catch (err) {

        console.error("Create Project Error:", err);

        return res.status(500).json({
            success: false,
            message: "Server error while creating project"
        });
    }
};

const geAlltProjects = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 12,
            search,
            tag,
            tech,
            sort = "latest"
        } = req.query;

        const query = { status: "PUBLISHED" };

        if (search) {
            query.$text = { $search: search };
        }

        if (tag) {
            query.tags = tag;
        }

        if (tech) {
            query.techStack = tech;
        }

        const sortMap = {
            latest: { createdAt: -1 },
            trending: { likeCount: -1 },
            mostViewed: { viewCount: -1 }
        };

        const projects = await Project
            .find(query)
            .populate("owner", "fullName avatar")
            .sort(sortMap[sort] || sortMap.latest)
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit));

        const total = await Project.countDocuments(query);

        return res.status(200).json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
            data: projects
        });
    } catch (error) {
        console.error("Get All Projects Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching projects",
            error: error.message
        });
    }
};

const getProjectBySlug = async (req, res) => {
    try {
        if (!req.params.slug) {
            return res.status(400).json({
                success: false,
                message: "Project slug is required"
            });
        }

        const project = await Project
            .findOne({ slug: req.params.slug })
            .populate("owner", "fullName avatar email");

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: project
        });
    } catch (error) {
        console.error("Get Project By Slug Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching project",
            error: error.message
        });
    }
};


const registerView = async (req, res) => {
    try {
        if (!req.params.id) {
            return res.status(400).json({
                success: false,
                message: "Project ID is required"
            });
        }

        const hash = crypto
            .createHash("sha256")
            .update(req.ip + req.headers["user-agent"])
            .digest("hex");

        const exists = await ProjectView.findOne({
            project: req.params.id,
            viewerHash: hash,
            createdAt: {
                $gte: new Date(Date.now() - 1000 * 60 * 60 * 24)
            }
        });

        if (!exists) {
            await ProjectView.create({
                project: req.params.id,
                viewerHash: hash
            });

            await Project.findByIdAndUpdate(
                req.params.id,
                { $inc: { viewCount: 1 } },
                { new: true }
            );
        }

        return res.status(200).json({
            success: true,
            message: "View registered successfully"
        });
    } catch (error) {
        console.error("Register View Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while registering view",
            error: error.message
        });
    }
};

const toggleLike = async (req, res) => {
    try {
        if (!req.params.id) {
            return res.status(400).json({
                success: false,
                message: "Project ID is required"
            });
        }

        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const userId = req.user.id;
        const projectId = req.params.id;

        const existing = await ProjectLike.findOne({
            user: userId,
            project: projectId
        });

        if (existing) {
            await existing.deleteOne();

            await Project.findByIdAndUpdate(
                projectId,
                { $inc: { likeCount: -1 } },
                { new: true }
            );

            return res.status(200).json({
                success: true,
                message: "Like removed successfully",
                liked: false
            });
        }

        await ProjectLike.create({
            user: userId,
            project: projectId
        });

        await Project.findByIdAndUpdate(
            projectId,
            { $inc: { likeCount: 1 } },
            { new: true }
        );

        return res.status(200).json({
            success: true,
            message: "Like added successfully",
            liked: true
        });
    } catch (error) {
        console.error("Toggle Like Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while toggling like",
            error: error.message
        });
    }
};

module.exports = {
    geAlltProjects,
    getProjectBySlug,
    registerView,
    toggleLike,
    createProject
};