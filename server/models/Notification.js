import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true }, // recipient
    fromUserId: { type: String, required: true },
    type: { type: String, enum: ["like", "comment", "reply", "follow"], required: true },
    postId: { type: String },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Notification = mongoose.model("Notification", NotificationSchema);
export default Notification;


