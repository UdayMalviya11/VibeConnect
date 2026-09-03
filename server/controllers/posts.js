import Post from "../models/Post.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { emitToUser } from "../realtime/io.js";

const normalizeCommentsShape = (post) => {
  if (!post) return false;
  let changed = false;
  if (!Array.isArray(post.comments)) {
    post.comments = [];
    return true;
  }

  const isValidEntry = (entry) =>
    entry && typeof entry.userId === "string" && typeof entry.text === "string" && entry.text.trim().length > 0;

  const ensureLikesMap = (likes) => {
    if (!likes) return new Map();
    if (likes instanceof Map) return likes;
    if (typeof likes === "object") return new Map(Object.entries(likes));
    return new Map();
  };

  const normalizeReplies = (replies) => {
    if (!Array.isArray(replies)) return [];
    const normalized = [];
    for (const r of replies) {
      if (typeof r === "string") {
        // drop legacy string replies entirely
        changed = true;
        continue;
      }
      if (!isValidEntry(r)) {
        changed = true;
        continue;
      }
      r.likes = ensureLikesMap(r.likes);
      normalized.push(r);
    }
    return normalized;
  };

  const normalizedComments = [];
  for (const c of post.comments) {
    if (typeof c === "string") {
      // drop legacy string comments (user requested removing static/null comments)
      changed = true;
      continue;
    }
    if (!c || typeof c !== "object") {
      changed = true;
      continue;
    }
    if (!isValidEntry(c)) {
      changed = true;
      continue;
    }
    c.likes = ensureLikesMap(c.likes);
    c.replies = normalizeReplies(c.replies);
    normalizedComments.push(c);
  }

  if (normalizedComments.length !== post.comments.length) changed = true;
  post.comments = normalizedComments;
  return changed;
};

// Helper: Sanitize text input (prevent XSS, limit size)
const sanitizeText = (text) => {
  if (typeof text !== "string") return "";
  return text.trim().substring(0, 5000); // Max 5000 chars
};

/* CREATE */
export const createPost = async (req, res) => {
  try {
    const { userId, description } = req.body;

    // Validate required fields
    if (!userId || !description) {
      return res.status(400).json({ message: "userId and description are required" });
    }

    // Sanitize description
    const sanitizedDescription = sanitizeText(description);
    if (!sanitizedDescription) {
      return res.status(400).json({ message: "Description cannot be empty" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({ message: "Invalid user" });
    }

    // Map uploaded files to attachments (supports fields upload.fields)
    const files = Array.isArray(req.files)
      ? req.files
      : [
          ...(Array.isArray(req.files?.attachments) ? req.files.attachments : []),
          ...(Array.isArray(req.files?.picture) ? req.files.picture : []),
        ];

    const attachments = files
      .filter(Boolean)
      .map((f) => {
        const mime = f.mimetype || "";
        let type = "file";
        if (mime.startsWith("image/")) type = "image";
        else if (mime.startsWith("video/")) type = "video";
        else if (mime.startsWith("audio/")) type = "audio";
        return {
          type,
          path: f.filename || f.originalname,
          name: f.originalname,
          size: f.size,
          mime,
        };
      });

    // backward compat: preserve single picturePath if image uploaded
    const primaryImage = attachments.find((a) => a.type === "image");

    const newPost = new Post({
      userId,
      firstName: user.firstName,
      lastName: user.lastName,
      location: user.location,
      description: sanitizedDescription,
      userPicturePath: user.picturePath,
      picturePath: primaryImage ? primaryImage.path : undefined,
      attachments,
      likes: {},
      comments: [],
    });

    const savedPost = await newPost.save();
    res.status(201).json(savedPost);
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ message: err.message || "Failed to create post" });
  }
};

/* READ */
export const getFeedPosts = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "0", 10), 0);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "10", 10), 1), 50);
    const query = {};

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(page * limit)
      .limit(limit);

    res.status(200).json(posts);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

export const getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = Math.max(parseInt(req.query.page || "0", 10), 0);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "10", 10), 1), 50);
    const query = { userId };

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(page * limit)
      .limit(limit);

    res.status(200).json(posts);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

/* UPDATE */
export const likePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const isLiked = post.likes.get(userId);

    if (isLiked) {
      post.likes.delete(userId);
    } else {
      post.likes.set(userId, true);
    }

    const updatedPost = await Post.findByIdAndUpdate(id, { likes: post.likes }, { new: true });

    // increment impressions for post owner on engagement
    try {
      const owner = await User.findById(updatedPost.userId);
      if (owner) {
        owner.impressions = (owner.impressions || 0) + 1;
        await owner.save();
        try {
          emitToUser(String(owner._id), "engagement:update", {
            userId: String(owner._id),
            viewedProfile: owner.viewedProfile || 0,
            impressions: owner.impressions || 0,
          });
        } catch {}
      }
    } catch (err) {
      console.error("Error updating owner impressions:", err.message);
    }

    // create notification for post like (only when liking and not self-like)
    try {
      if (!isLiked && String(updatedPost.userId) !== String(userId)) {
        await Notification.create({
          userId: String(updatedPost.userId),
          fromUserId: String(userId),
          type: "like",
          postId: String(updatedPost._id),
        });
      }
    } catch (err) {
      console.error("Error creating like notification:", err.message);
    }

    res.status(200).json(updatedPost);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

export const getPostById = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    res.status(200).json(post);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

/* COMMENTS */
export const addComment = async (req, res) => {
  try {
    console.log("=== BACKEND COMMENT DEBUG ===");
    console.log("Request params:", req.params);
    console.log("Request body:", req.body);

    const { id } = req.params; // post id
    const { userId, text } = req.body;

    // Authorization: only allow the authenticated user to comment as themselves
    if (!req.user || String(req.user.id) !== String(userId)) {
      return res.status(403).json({ message: "Forbidden: cannot comment as another user" });
    }

    console.log("Extracted - Post ID:", id);
    console.log("Extracted - User ID:", userId);
    console.log("Extracted - Text:", text);

    // Validate required fields
    if (!userId || !text) {
      console.log("Validation failed - missing required fields");
      return res.status(400).json({ message: "User ID and comment text are required" });
    }

    // Sanitize comment text
    const sanitizedText = sanitizeText(text);
    if (!sanitizedText) {
      return res.status(400).json({ message: "Comment cannot be empty" });
    }

    console.log("Looking for post with ID:", id);
    const post = await Post.findById(id);
    if (!post) {
      console.log("Post not found with ID:", id);
      return res.status(404).json({ message: "Post not found" });
    }

    console.log("Post found:", post._id);
    console.log("Current comments:", post.comments);

    // Normalize comments structure
    const changed = normalizeCommentsShape(post);
    if (changed) {
      console.log("Comments structure normalized");
      await post.save();
    }

    // Add new comment
    const newComment = {
      userId,
      text: sanitizedText,
      likes: new Map(),
      replies: [],
    };

    console.log("Adding new comment:", newComment);
    post.comments.push(newComment);
    await post.save();

    // create notification to post owner if commenter isn't the owner
    if (String(post.userId) !== String(userId)) {
      try {
        await Notification.create({
          userId: String(post.userId),
          fromUserId: String(userId),
          type: "comment",
          postId: String(post._id),
        });
      } catch (err) {
        console.error("Error creating comment notification:", err.message);
      }
    }

    console.log("Comment added successfully. Updated comments:", post.comments);

    // increment impressions for post owner
    try {
      const owner = await User.findById(post.userId);
      if (owner) {
        owner.impressions = (owner.impressions || 0) + 1;
        await owner.save();
        try {
          emitToUser(String(owner._id), "engagement:update", {
            userId: String(owner._id),
            viewedProfile: owner.viewedProfile || 0,
            impressions: owner.impressions || 0,
          });
        } catch {}
      }
    } catch (err) {
      console.error("Error updating owner impressions on comment:", err.message);
    }

    res.status(201).json(post);
  } catch (err) {
    console.error("Error adding comment:", err);
    console.error("Error stack:", err.stack);
    res.status(400).json({ message: err.message || "Unable to add comment" });
  }
};

export const likeComment = async (req, res) => {
  try {
    const { id, commentId } = req.params; // post id, comment id
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    if (!req.user || String(req.user.id) !== String(userId)) {
      return res.status(403).json({ message: "Forbidden: cannot like as another user" });
    }

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const changed = normalizeCommentsShape(post);
    if (changed) await post.save();

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const isLiked = comment.likes.get(userId);
    if (isLiked) comment.likes.delete(userId);
    else comment.likes.set(userId, true);

    await post.save();

    // create notification for like (only when liking and not self-like)
    if (!isLiked && String(post.userId) !== String(userId)) {
      try {
        await Notification.create({
          userId: String(post.userId),
          fromUserId: String(userId),
          type: "like",
          postId: String(post._id),
        });
      } catch (err) {
        console.error("Error creating comment like notification:", err.message);
      }
    }

    res.status(200).json(post);
  } catch (err) {
    res.status(400).json({ message: err.message || "Unable to like comment" });
  }
};

export const replyToComment = async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const { userId, text } = req.body;

    if (!userId || !text) {
      return res.status(400).json({ message: "userId and text are required" });
    }

    if (!req.user || String(req.user.id) !== String(userId)) {
      return res.status(403).json({ message: "Forbidden: cannot reply as another user" });
    }

    // Sanitize reply text
    const sanitizedText = sanitizeText(text);
    if (!sanitizedText) {
      return res.status(400).json({ message: "Reply cannot be empty" });
    }

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const changed = normalizeCommentsShape(post);
    if (changed) await post.save();

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    comment.replies.push({ userId, text: sanitizedText, likes: {} });
    await post.save();

    // create notification to post owner if replier isn't the owner
    if (String(post.userId) !== String(userId)) {
      try {
        await Notification.create({
          userId: String(post.userId),
          fromUserId: String(userId),
          type: "reply",
          postId: String(post._id),
        });
      } catch (err) {
        console.error("Error creating reply notification:", err.message);
      }
    }

    // increment impressions for post owner
    try {
      const owner = await User.findById(post.userId);
      if (owner) {
        owner.impressions = (owner.impressions || 0) + 1;
        await owner.save();
        try {
          emitToUser(String(owner._id), "engagement:update", {
            userId: String(owner._id),
            viewedProfile: owner.viewedProfile || 0,
            impressions: owner.impressions || 0,
          });
        } catch {}
      }
    } catch (err) {
      console.error("Error updating owner impressions on reply:", err.message);
    }

    res.status(201).json(post);
  } catch (err) {
    res.status(400).json({ message: err.message || "Unable to add reply" });
  }
};

export const likeReply = async (req, res) => {
  try {
    const { id, commentId, replyId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const changed = normalizeCommentsShape(post);
    if (changed) await post.save();

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const reply = comment.replies.id(replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });

    const isLiked = reply.likes.get(userId);
    if (isLiked) reply.likes.delete(userId);
    else reply.likes.set(userId, true);

    await post.save();
    res.status(200).json(post);
  } catch (err) {
    res.status(400).json({ message: err.message || "Unable to like reply" });
  }
};
