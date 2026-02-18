const express = require("express");
const { getProjectBySlug, geAlltProjects, registerView, toggleLike, createProject } = require("../../../controllers/public/project/projectController");
const { verifyToken } = require("../../../middlewares/authMiddlewares/verifyToken");
const uploadProjectMedia = require("../../../middlewares/cloudinary/uploadProjectMedia");
const router = express.Router();

router.get('/all', geAlltProjects);
router.get('/:slug', getProjectBySlug)
router.post('/view/:id', registerView);
router.post('/like/:id', verifyToken(), toggleLike);

router.post(
    "/create",
    verifyToken(),
    uploadProjectMedia,
    createProject
);

module.exports = router;