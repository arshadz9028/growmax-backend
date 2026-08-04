import mongoose from "mongoose";

const userProfileSchema = new mongoose.Schema(
  {
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
      default: null,
    },

    refreshTokenExpiry: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const userSchema = new mongoose.Schema(
  {
    googleUid: {
      type: String,
      default: "",
      index: true,
      trim: true,
    },

    username: {
      type: String,
      default: "",
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    provider: {
      type: String,
      enum: ["google"],
      default: "google",
    },

    photoURL: {
      type: String,
      default: "",
    },

    userProfile: {
      type: userProfileSchema,
      required: true,
    },
    service: {
      type: [
        {
          name: {
            type: String,
            default: "",
          },
          reg_date: {
            type: Date,
            default: null,
          },
          active: {
            type: Boolean,
            default: false,
          },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "users",
  }
);

const User =
  mongoose.models.User ||
  mongoose.model("User", userSchema);

export default User;