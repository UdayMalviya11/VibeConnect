import mongoose from "mongoose";

const ConversationSchema = new mongoose.Schema(
  {
    participants: { type: [String], required: true }, // [userIdA, userIdB]
    lastMessageText: { type: String, default: "" },
  },
  { timestamps: true }
);

ConversationSchema.index({ participants: 1 });

const Conversation = mongoose.model("Conversation", ConversationSchema);
export default Conversation;


