const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const streamifier = require("streamifier");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const memoryStorage = multer.memoryStorage();
const uploadProfile = multer({ storage: memoryStorage });
const uploadCloth = multer({ storage: memoryStorage });

function uploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result.secure_url);
      },
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

function uploadProfileImage(buffer) {
  return uploadToCloudinary(buffer, {
    folder: "stitch/profiles",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 400, height: 400, crop: "fill" }],
  });
}

function uploadClothImage(buffer) {
  return uploadToCloudinary(buffer, {
    folder: "stitch/cloth",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 800, height: 800, crop: "limit" }],
  });
}

module.exports = {
  cloudinary,
  uploadProfile,
  uploadCloth,
  uploadProfileImage,
  uploadClothImage,
};
