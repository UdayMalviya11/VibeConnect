import mongoose from "mongoose";

const FeedbackSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    imagePath: { type: String, default: "" },
    status: { type: String, enum: ["new", "reviewing", "resolved"], default: "new" },
  },
  { timestamps: true }
);

const Feedback = mongoose.model("Feedback", FeedbackSchema);
export default Feedback;


