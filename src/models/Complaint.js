import mongoose from "mongoose";

const ComplaintSchema = new mongoose.Schema(
  {
    serviceType: {
      type: String,
      default: "complaint",
      trim: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    consumerNo: {
      type: String,
      required: true,
      trim: true,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },

    issueType: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    submittedAt: {
      type: Date,
      default: Date.now,
    },

    status: {
      type: String,
      enum: ["pending", "contacted", "resolved", "cancelled"],
      default: "pending",
    },
  },
  {
    timestamps: true,
    collection: "complaints",
  }
);

export default mongoose.models.Complaint || mongoose.model("Complaint", ComplaintSchema);
