import mongoose from "mongoose";

const VisitSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["UpComing", "Pending", "Completed"],
      default: "UpComing",
    },
    assignedTechnicianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Technician",
      default: null,
    },
    assignedTechnicianName: {
      type: String,
      default: "",
      trim: true,
    },
    assignmentStatus: {
      type: String,
      enum: ["assigned", "unassigned"],
      default: "unassigned",
    },
    assignedAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const ConsumerManagementSchema = new mongoose.Schema(
  {
    userCode: {
      type: String,
      default: "",
    },

    totalVisit: {
      type: Number,
      default: 14,
    },

    markedVisit: {
      type: Number,
      default: 0,
    },

    remainingVisit: {
      type: Number,
      default: 14,
    },

    selectedVisits: {
      type: [VisitSchema],
      default: [],
    },
  },
  {
    _id: false,
  }
);

const GrowCleaningApplicationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    mobileNumber: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    address: {
      type: String,
      required: true,
      trim: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
    },

   
    totalAmount: {
      type: Number,
      default: 0,
    },
    serviceName: {
      type: String,
      default: "",
      trim: true,
    },
    consumerNumber: {
      type: String,
      default: "",
      trim: true,
    },

    consumerNo: {
      type: String,
      default: "",
      trim: true,
    },

    latitude: {
      type: Number,
      required: true,
    },

    longitude: {
      type: Number,
      required: true,
    },

    locationAddress: {
      type: String,
      default: "",
      trim: true,
    },

    landmark: {
      type: String,
      default: "",
      trim: true,
    },

    sitePhotoUrl: {
      type: String,
      default: "",
      trim: true,
    },

    agreedToTerms: {
      type: Boolean,
      default: false,
    },

    paymentMethod: {
      type: String,
      default: "pending",
    },

    transactionId: {
      type: String,
      default: "",
    },

    numberOfPanels: {
      type: Number,
      default: 1,
      min: 1,
    },

    sprinkler: {
      type: Boolean,
      default: false,
    },

    walkwayAndLadder: {
      type: Boolean,
      default: false,
    },

    requestStatus: {
      type: String,
      default: "pending",
    },

    status: {
      type: String,
      enum: [
        "pending",
        "contacted",
        "completed",
        "cancelled",
      ],
      default: "pending",
    },

    isNewNotification: {
      type: Boolean,
      default: true,
    },

    consumerManagement: {
      type: ConsumerManagementSchema,
      default: () => ({
        userCode: "",
        totalVisit: 14,
        markedVisit: 0,
        remainingVisit: 14,
        selectedVisits: [],
      }),
    },
  },
  {
    timestamps: true,
    collection: "growCleaningApplications",
  }
);

export default
  mongoose.models.GrowCleaningApplication ||
  mongoose.model(
    "GrowCleaningApplication",
    GrowCleaningApplicationSchema
  );