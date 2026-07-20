import mongoose from "mongoose";
const VisitSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    status: {
      type: String,
      enum: ["UpComing", "Pending", "Completed"],
      default: "UpComing",
    },
  },
  { _id: false },
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
    selectedVisits: [VisitSchema],
  },
  { _id: false },
);

const growCleaningSchema = new mongoose.Schema(
  {
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
      trim: true,
      lowercase: true,
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
    userProfile: {
      userName: {
        type: String,
        default: "",
      },
      userToken: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },
      secureToken: {
        type: String,
        default: "",
      },
      refreshToken: {
        type: String,
        default: "",
      },
      secureTokenExpiry: {
        type: Date,
      },
      refreshTokenExpiry: {
        type: Date,
      },
    },

    state: {
      type: String,
      required: true,
      trim: true,
    },
    pinCode: {
      type: String,
      required: true,
      trim: true,
    },
    consumerNumber: {
      type: String,
      trim: true,
      default: "",
    },
    consumerNo: {
      type: String,
      trim: true,
      default: "",
    },
    isNewNotification: { type: Boolean, default: true },
    requestStatus: { type: String, default: "pending" },

    agreedToTerms: {
      type: Boolean,
      required: true,
      default: false,
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
      trim: true,
      default: "",
    },
    sitePhotoUrl: {
      type: String,
      trim: true,
      default: "",
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
    paymentMethod: {
      type: String,
      required: true,
      trim: true,
      default: "pending",
    },
    transactionId: {
      type: String,
      trim: true,
      default: "",
    },
    numberOfPanels: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    sprinkler: {
      type: Boolean,
      default: false,
    },
    walkwayAndLadder: {
      type: Boolean,
      default: false,
    },
    landmark: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "contacted", "completed", "cancelled"],
      default: "pending",
    },
  },
  {
    timestamps: true,
    collection: "servicerecords",
  },
);

const GrowCleaningApplication =
  mongoose.models.GrowCleaningApplication ||
  mongoose.model(
    "GrowCleaningApplication",
    growCleaningSchema,
    "servicerecords",
  );

export default GrowCleaningApplication;
