import mongoose from "mongoose";

const SolarAMCApplicationSchema = new mongoose.Schema(
  {
    serviceType: {
      type: String,
      default: "solar-amc",
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

    consumerName: {
      type: String,
      required: true,
      trim: true,
    },

    consumerAddress: {
      type: String,
      required: true,
      trim: true,
    },

    landmark: {
      type: String,
      default: "",
      trim: true,
    },

    primaryPhone: {
      type: String,
      required: true,
      trim: true,
    },

    secondaryPhone: {
      type: String,
      default: "",
      trim: true,
    },

    whatsappNumber: {
      type: String,
      default: "",
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    solarCapacityKw: {
      type: String,
      required: true,
      trim: true,
    },

    latitude: {
      type: String,
      default: "",
      trim: true,
    },

    longitude: {
      type: String,
      default: "",
      trim: true,
    },

    connectionType: {
      type: String,
      required: true,
      trim: true,
    },

    phase: {
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
      enum: ["pending", "contacted", "completed", "cancelled"],
      default: "pending",
    },
  },
  {
    timestamps: true,
    collection: "solarAMCApplications",
  }
);

export default
  mongoose.models.SolarAMCApplication ||
  mongoose.model("SolarAMCApplication", SolarAMCApplicationSchema);
