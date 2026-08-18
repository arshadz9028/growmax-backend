import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    // Required for consumer/technician notifications.
    // Not required for admin because there is only one admin.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    recipientType: {
      type: String,
      enum: ["admin", "consumer", "technician"],
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: [
        "service",
        "payment",
        "order",
        "system",
        "approval",
        "general",
      ],
      default: "general",
    },

    data: {
      type: Object,
      default: {},
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Notification", notificationSchema);