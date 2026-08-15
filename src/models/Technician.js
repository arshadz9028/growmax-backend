import mongoose from "mongoose";

const AssignedVisitSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GrowCleaningApplication",
      required: true,
    },
    visitIndex: {
      type: Number,
      default: 0,
    },
    serviceName: {
      type: String,
      default: "",
      trim: true,
    },
    consumerName: {
      type: String,
      default: "",
      trim: true,
    },
    consumerNumber: {
      type: Number,
      default: 0,
      trim: true,
    },
    mobileNumber: {
      type: String,
      default: "",
      trim: true,
    },
    dateOfVisit: {
      type: Date,
      default: null,
    },
    location: {
      type: String,
      default: "",
      trim: true,
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      default: "UpComing",
    },
    reviewStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      trim: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    issueNote: {
      type: String,
      default: "",
      trim: true,
    },
    beforePhotoUrl: {
      type: String,
      default: "",
      trim: true,
    },
    afterPhotoUrl: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false }
);

const TechnicianSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      default: "",
      trim: true,
    },
    mobileNumber: {
      type: String,
      default: "",
      trim: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    city: {
      type: String,
      default: "",
      trim: true,
    },
    passwordHash: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      default: "technician",
    },
    active: {
      type: Boolean,
      default: true,
    },
    assignedVisits: {
      type: [AssignedVisitSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "technicians",
  }
);

export default mongoose.models.Technician || mongoose.model("Technician", TechnicianSchema);
