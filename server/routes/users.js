import express from "express";
import {
  getUser,
  getUserFriends,
  addRemoveFriend,
  incrementProfileView,
  updateSocialLinks,
} from "../controllers/users.js";
import { verifyToken } from "../middleware/auth.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { emitToUser } from "../realtime/io.js";
import Feedback from "../models/Feedback.js";

const router = express.Router();

// Debug logger for users router
router.use((req, res, next) => {
  if (req.originalUrl.startsWith("/users/")) {
    console.log("[users-router]", req.method, req.originalUrl);
  }
  next();
});

/* READ */
router.get("/:id/friends", verifyToken, getUserFriends);
router.get("/:id", verifyToken, getUser);

/* UPDATE */
// Ensure this route is registered early to avoid any potential path ambiguity
router.patch("/:id/:friendId", verifyToken, addRemoveFriend);
router.patch("/:id/socials", verifyToken, updateSocialLinks);

/* NOTIFICATIONS */
router.get("/:id/notifications", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.user || String(req.user.id) !== String(id)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const list = await Notification.find({ userId: String(id) }).sort({ createdAt: -1 }).limit(50).lean();
    // hydrate minimal sender info
    const senderIds = [...new Set(list.map((n) => n.fromUserId).filter(Boolean))];
    const senders = await User.find({ _id: { $in: senderIds } }).select("firstName lastName picturePath").lean();
    const senderMap = Object.fromEntries(senders.map((u) => [String(u._id), u]));
    const hydrated = list.map((n) => ({
      ...n,
      fromUser: senderMap[n.fromUserId] || null,
    }));
    res.status(200).json(hydrated);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

/* CHAT */
// Ensure users are friends before allowing chat
router.post("/:id/chat/:friendId/message", verifyToken, async (req, res) => {
  try {
    const { id, friendId } = req.params; // sender, recipient
    const { text, postId, postSnapshot, attachments } = req.body;
    if (!req.user || String(req.user.id) !== String(id)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    // allow any of text/post/attachments
    if ((!text || !String(text).trim()) && !postId && !postSnapshot && !(attachments && attachments.length)) {
      return res.status(400).json({ message: "Message requires content (text, post, or attachment)" });
    }
    const sender = await User.findById(id);
    const recipient = await User.findById(friendId);
    if (!sender || !recipient) return res.status(404).json({ message: "User not found" });
    // permit messaging to followed friends (one-way allowed)
    const isFriend = sender.friends?.includes(friendId);
    if (!isFriend) return res.status(403).json({ message: "You can only message people you follow" });

    // get or create conversation
    let convo = await Conversation.findOne({ participants: { $all: [String(id), String(friendId)] } });
    const preview = (text && String(text).trim()) || (postId || postSnapshot ? "[Shared a post]" : (attachments && attachments.length ? `[Shared ${attachments.length} attachment(s)]` : ""));
    if (!convo) {
      convo = await Conversation.create({ participants: [String(id), String(friendId)], lastMessageText: preview });
    } else {
      convo.lastMessageText = preview;
      await convo.save();
    }
    const msg = await Message.create({ conversationId: String(convo._id), fromUserId: String(id), toUserId: String(friendId), text: (String(text||"").trim()), postId, postSnapshot, attachments });
    // emit realtime to recipient and sender for immediate reflection
    const payload = { fromUserId: String(id), toUserId: String(friendId), text: msg.text, createdAt: msg.createdAt, _id: String(msg._id), postId, postSnapshot, attachments };
    try { emitToUser(friendId, "chat:new_message", payload); } catch {}
    try { emitToUser(id, "chat:new_message", payload); } catch {}
    res.status(201).json({ conversation: convo, message: msg });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.get("/:id/chat/:friendId/history", verifyToken, async (req, res) => {
  try {
    const { id, friendId } = req.params;
    if (!req.user || String(req.user.id) !== String(id)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const convo = await Conversation.findOne({ participants: { $all: [String(id), String(friendId)] } });
    if (!convo) return res.status(200).json([]);
    const messages = await Message.find({ conversationId: String(convo._id) }).sort({ createdAt: 1 }).lean();
    res.status(200).json(messages);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// chat overview: list conversations with last message text and friend info
router.get("/:id/chat/overview", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.user || String(req.user.id) !== String(id)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const convos = await Conversation.find({ participants: String(id) }).sort({ updatedAt: -1 }).lean();
    const otherIds = [...new Set(convos.map(c => c.participants.find(p => p !== String(id))).filter(Boolean))];
    const users = await User.find({ _id: { $in: otherIds } }).select("firstName lastName picturePath occupation location").lean();
    const usersMap = Object.fromEntries(users.map(u => [String(u._id), u]));
    const result = convos.map(c => {
      const otherId = c.participants.find(p => p !== String(id));
      return {
        friendId: otherId,
        lastMessageText: c.lastMessageText || "",
        friend: usersMap[otherId] || null,
        updatedAt: c.updatedAt,
      };
    });
    res.status(200).json(result);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// unread messages count for header badge
router.get("/:id/chat/unread-count", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.user || String(req.user.id) !== String(id)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const count = await Message.countDocuments({ toUserId: String(id), read: false });
    res.status(200).json({ count });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// mark messages from friend as read in conversation
router.patch("/:id/chat/:friendId/read", verifyToken, async (req, res) => {
  try {
    const { id, friendId } = req.params;
    if (!req.user || String(req.user.id) !== String(id)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const convo = await Conversation.findOne({ participants: { $all: [String(id), String(friendId)] } });
    if (!convo) return res.status(200).json({ updated: 0 });
    const result = await Message.updateMany({ conversationId: String(convo._id), toUserId: String(id), read: false }, { $set: { read: true } });
    res.status(200).json({ updated: result.modifiedCount || 0 });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});
router.post("/:id/view", verifyToken, incrementProfileView);

/* SUPPORT/FEEDBACK */
router.post("/:id/support/feedback", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.user || String(req.user.id) !== String(id)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const { title, description, imagePath } = req.body;
    if (!title || !description) return res.status(400).json({ message: "Title and description are required" });
    const fb = await Feedback.create({ userId: String(id), title, description, imagePath: imagePath || "" });
    res.status(201).json(fb);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

export default router;
