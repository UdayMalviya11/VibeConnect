import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true },
    fromUserId: { type: String, required: true },
    toUserId: { type: String, required: true },
    text: { type: String, default: "" },
    read: { type: Boolean, default: false },
    postId: { type: String },
    postSnapshot: {
      description: String,
      picturePath: String,
      authorId: String,
      authorName: String,
    },
    attachments: [
      {
        type: { type: String, enum: ["image", "video", "audio", "file"], default: "file" },
        url: String,
        thumbnail: String,
        duration: Number,
      },
    ],
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", MessageSchema);
export default Message;


