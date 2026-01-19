import multer from "multer";

const storage = multer.memoryStorage();


// 🖼️ Images
export const uploadImages = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_, file, cb) => {
        console.log(file); 

    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images are allowed"));
  },
});

// 🎥 Videos
export const uploadVideos = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (_, file, cb) => {
    console.log(file.mimetype); 
    if (file.mimetype.startsWith("video/")) cb(null, true);
    else cb(new Error("Only videos are allowed"));
  },
});

// 📄 Documents
export const uploadDocs = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_, file, cb) => {
    const docs = ["application/pdf"];
    docs.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Only PDFs allowed"));
  },
  });