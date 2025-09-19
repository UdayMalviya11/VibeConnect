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
import { users, posts } from "../data/index.js";

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

// CORS configuration for Vercel
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://vibe-connect-ws2o.vercel.app",
    /^https:\/\/.*\.vercel\.app$/
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

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

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Export for Vercel
export default app;
