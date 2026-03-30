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
import authRoutes from "../routes/auth.js";
import userRoutes from "../routes/users.js";
import postRoutes from "../routes/posts.js";
import { register } from "../controllers/auth.js";
import { createPost } from "../controllers/posts.js";
import { verifyToken } from "../middleware/auth.js";
import User from "../models/User.js";
import Post from "../models/Post.js";
// import { users, posts } from "../data/index.js"; // keep disabled in production

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

// CORS configuration
app.use(
  cors({
    origin: function (origin, callback) {
      // Accept all origins dynamically to prevent CORS errors during dev/deployment
      callback(null, origin || "*");
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

app.use("/assets", express.static(path.join(__dirname, "../public/assets")));

/* FILE STORAGE */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../public/assets"));
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const base = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, "_");
    cb(null, `${unique}-${base}`);
  },
});
const upload = multer({ storage });

/* ROUTES WITH FILES */
app.post("/auth/register", upload.single("picture"), register);
app.post(
  "/posts",
  verifyToken,
  upload.fields([
    { name: "attachments", maxCount: 20 },
    { name: "picture", maxCount: 1 },
  ]),
  createPost
);

/* ROUTES */
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/posts", postRoutes);

/* MONGOOSE SETUP */
mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => console.log(`${error} did not connect`));

// Root endpoint
app.get("/", (req, res) => {
  res.json({ 
    message: "VibeConnect API Server", 
    status: "running",
    timestamp: new Date().toISOString(),
    endpoints: ["/auth", "/users", "/posts", "/health", "/test"]
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
  console.error('Error:', err);
  res.status(500).json({ error: 'Something went wrong!', message: err?.message });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

// Export for Vercel
export default app;
