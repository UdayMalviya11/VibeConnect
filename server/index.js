import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import postRoutes from "./routes/posts.js";
import { register } from "./controllers/auth.js";
import { createPost } from "./controllers/posts.js";
import { verifyToken } from "./middleware/auth.js";
import User from "./models/User.js";
import Post from "./models/Post.js";
// import { users, posts } from "./data/index.js"; // keep disabled in production
import { initIO } from "./realtime/io.js";

/* CONFIGURATIONS */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();
const app = express();

app.use(express.json());
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(morgan("common"));
app.use(bodyParser.json({ limit: "30mb", extended: true }));
app.use(bodyParser.urlencoded({ limit: "30mb", extended: true }));

/* SECURE CORS CONFIGURATION */
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:3000", "http://localhost:3001"];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, curl, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy: origin ${origin} is not allowed`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    exposedHeaders: ["Content-Type"],
    optionsSuccessStatus: 200,
  })
);

app.use("/assets", express.static(path.join(__dirname, "public/assets")));

/* FILE STORAGE WITH VALIDATION */
// File size limits (in bytes)
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB for all files
const MAX_PROFILE_PIC_SIZE = 5 * 1024 * 1024; // 5MB for profile pictures

// Allowed MIME types
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime"];
const ALLOWED_AUDIO_TYPES = ["audio/mpeg", "audio/wav", "audio/ogg"];
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const ALLOWED_MIME_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
  ...ALLOWED_AUDIO_TYPES,
  ...ALLOWED_FILE_TYPES,
];

const fileFilter = (req, file, cb) => {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      new Error(
        `File type not allowed: ${file.mimetype}. Allowed types: images, videos, audio, PDFs, documents`
      )
    );
  }

  // Check file size based on field name
  const maxSize = file.fieldname === "picture" ? MAX_PROFILE_PIC_SIZE : MAX_FILE_SIZE;
  if (file.size > maxSize) {
    return cb(
      new Error(
        `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Max size: ${(maxSize / 1024 / 1024).toFixed(2)}MB`
      )
    );
  }

  cb(null, true);
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "public/assets"));
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const base = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, "_");
    cb(null, `${unique}-${base}`);
  },
});

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

/* ERROR HANDLER FOR MULTER */
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large" });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({ error: "Too many files" });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

/* ROUTES WITH FILES */
app.post(
  "/auth/register",
  upload.single("picture"),
  handleMulterError,
  register
);
app.post(
  "/posts",
  verifyToken,
  upload.fields([
    { name: "attachments", maxCount: 20 },
    { name: "picture", maxCount: 1 },
  ]),
  handleMulterError,
  createPost
);

/* ROUTES */
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/posts", postRoutes);

/* MONGOOSE SETUP WITH CONNECTION POOLING */
const MONGODB_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  minPoolSize: 2,
  maxIdleTimeMS: 45000,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

let server = null;

mongoose
  .connect(process.env.MONGO_URL, MONGODB_OPTIONS)
  .then(() => {
    console.log("Connected to MongoDB with connection pooling");
    const PORT = process.env.PORT || 3001;
    server = app.listen(PORT, () => {
      console.log(`Server Port: ${PORT}`);
    });
    initIO(server);

    /* ADD DATA ONE TIME */
    // User.insertMany(users);
    // Post.insertMany(posts);
  })
  .catch((error) => {
    console.error(`MongoDB connection failed: ${error.message}`);
    process.exit(1);
  });

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "VibeConnect API Server",
    status: "running",
    timestamp: new Date().toISOString(),
    endpoints: ["/auth", "/users", "/posts", "/health", "/test"],
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Test endpoint
app.get("/test", (req, res) => {
  res.json({ message: "Server is working!", origin: req.headers.origin });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    error: "Something went wrong!",
    message: err?.message,
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found", path: req.originalUrl });
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down gracefully...");
  if (server) server.close();
  await mongoose.disconnect();
  process.exit(0);
});

// Export for Vercel
export default app;
