import express from "express";
import { getFeedPosts, getUserPosts, likePost, addComment, likeComment, replyToComment, likeReply, getPostById } from "../controllers/posts.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

/* READ */
router.get("/", verifyToken, getFeedPosts);
router.get("/:id", verifyToken, getPostById);
router.get("/:userId/posts", verifyToken, getUserPosts);

/* UPDATE */
router.patch("/:id/like", verifyToken, likePost);
router.post("/:id/comments", verifyToken, addComment);
router.patch("/:id/comments/:commentId/like", verifyToken, likeComment);
router.post("/:id/comments/:commentId/replies", verifyToken, replyToComment);
router.patch("/:id/comments/:commentId/replies/:replyId/like", verifyToken, likeReply);

export default router;
