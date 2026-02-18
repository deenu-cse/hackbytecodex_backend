const mongoose = require("mongoose");
const slugify = require("slugify");

const projectSchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120
    },

    slug: {
        type: String,
        unique: true,
        index: true
    },

    description: {
        type: String,
        required: true,
        maxlength: 5000
    },

    shortDescription: {
        type: String,
        maxlength: 300
    },

    coverImage: {
        url: String,
        public_id: String
    },

    images: [
        {
            url: String,
            public_id: String
        }
    ],

    videos: [
        {
            url: String,
            public_id: String
        }
    ],

    techStack: [{
        type: String,
        index: true
    }],

    tags: [{
        type: String,
        index: true
    }],

    links: [{
        label: String,
        url: String
    }],

    github: String,
    live: String,

    status: {
        type: String,
        enum: ["DRAFT", "PUBLISHED"],
        default: "PUBLISHED",
        index: true
    },

    likeCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },

    featured: {
        type: Boolean,
        default: false,
        index: true
    }

}, { timestamps: true });

projectSchema.pre("validate", async function (next) {

    if (!this.isModified("title")) return next();

    let baseSlug = slugify(this.title, {
        lower: true,
        strict: true
    });

    let slug = baseSlug;
    let counter = 1;

    while (await mongoose.models.Project.findOne({ slug })) {
        slug = `${baseSlug}-${counter++}`;
    }

    this.slug = slug;

    next();
});

projectSchema.pre("save", function (next) {

    if (!this.shortDescription) {
        this.shortDescription =
            this.description.substring(0, 180);
    }

    next();
});
projectSchema.index({
    title: "text",
    description: "text",
    tags: "text"
});

module.exports = mongoose.model("Project", projectSchema);