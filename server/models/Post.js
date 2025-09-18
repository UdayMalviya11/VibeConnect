import mongoose from "mongoose";

const replySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    text: { type: String, required: true },
    likes: { type: Map, of: Boolean, default: {} },
  },
  { timestamps: true, _id: true }
);

const commentSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    text: { type: String, required: true },
    likes: { type: Map, of: Boolean, default: {} },
    replies: { type: [replySchema], default: [] },
  },
  { timestamps: true, _id: true }
);

const postSchema = mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    location: String,
    description: String,
    picturePath: String,
    attachments: [
      {
        type: { type: String, enum: ["image", "video", "audio", "file"], required: true },
        path: { type: String, required: true },
        name: { type: String },
        size: { type: Number },
        mime: { type: String },
      },
    ],
    userPicturePath: String,
    likes: {
      type: Map,
      of: Boolean,
    },
    comments: { type: [commentSchema], default: [] },
  },
  { timestamps: true }
);

const Post = mongoose.model("Post", postSchema);

export default Post;
