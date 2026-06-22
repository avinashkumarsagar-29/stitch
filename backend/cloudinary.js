const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const profileStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "stitch/profiles",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 400, height: 400, crop: "fill" }],
  },
});

const clothStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "stitch/cloth",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 800, height: 800, crop: "limit" }],
  },
});

const uploadProfile = multer({ storage: profileStorage });
const uploadCloth = multer({ storage: clothStorage });

module.exports = { cloudinary, uploadProfile, uploadCloth };
