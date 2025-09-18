import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { emitToUser } from "../realtime/io.js";

/* READ */
export const getUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    res.status(200).json(user);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

export const getUserFriends = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    const friends = await Promise.all(
      user.friends.map((id) => User.findById(id))
    );
    const formattedFriends = friends.map(
      ({ _id, firstName, lastName, occupation, location, picturePath }) => {
        return { _id, firstName, lastName, occupation, location, picturePath };
      }
    );
    res.status(200).json(formattedFriends);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

/* UPDATE */
export const addRemoveFriend = async (req, res) => {
  try {
    const { id, friendId } = req.params;
    console.log("[addRemoveFriend] PATCH /users/:id/:friendId", { id, friendId });
    const user = await User.findById(id);
    const friend = await User.findById(friendId);
    if (!user || !friend) {
      console.log("[addRemoveFriend] User or Friend not found", { userFound: !!user, friendFound: !!friend });
    }

    if (user.friends.includes(friendId)) {
      user.friends = user.friends.filter((existingFriendId) => existingFriendId !== friendId);
      friend.friends = friend.friends.filter((existingFriendId) => existingFriendId !== id);
    } else {
      user.friends.push(friendId);
      friend.friends.push(id);
    }
    await user.save();
    await friend.save();

    // Notification when starting to follow
    if (user.friends.includes(friendId)) {
      try { await Notification.create({ userId: String(friendId), fromUserId: String(id), type: "follow" }); } catch {}
    }

    const friends = await Promise.all(
      user.friends.map((id) => User.findById(id))
    );
    const formattedFriends = friends.map(
      ({ _id, firstName, lastName, occupation, location, picturePath }) => {
        return { _id, firstName, lastName, occupation, location, picturePath };
      }
    );

    console.log("[addRemoveFriend] Success. Friends count:", formattedFriends.length);
    res.status(200).json(formattedFriends);
  } catch (err) {
    console.error("[addRemoveFriend] Error:", err);
    res.status(404).json({ message: err.message });
  }
};

/* ENGAGEMENT */
export const incrementProfileView = async (req, res) => {
  try {
    const { id } = req.params;
    // Do not count self-views
    if (req.user && String(req.user.id) === String(id)) {
      return res.status(200).json({ viewedProfile: undefined, skipped: true });
    }
    const user = await User.findById(id);
    user.viewedProfile = (user.viewedProfile || 0) + 1;
    await user.save();
    try { emitToUser(String(id), "engagement:update", { userId: String(id), viewedProfile: user.viewedProfile, impressions: user.impressions || 0 }); } catch {}
    res.status(200).json({ viewedProfile: user.viewedProfile });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/* UPDATE SOCIAL LINKS */
export const updateSocialLinks = async (req, res) => {
  try {
    const { id } = req.params;
    const { twitterUrl, linkedinUrl } = req.body;
    // Authorization: only the authenticated user can update their socials
    if (!req.user || String(req.user.id) !== String(id)) {
      return res.status(403).json({ message: "Forbidden: cannot update another user's profile" });
    }
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (typeof twitterUrl === "string") user.twitterUrl = twitterUrl;
    if (typeof linkedinUrl === "string") user.linkedinUrl = linkedinUrl;
    await user.save();
    const { password, ...safe } = user.toObject();
    res.status(200).json(safe);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
