import mongoose from "mongoose";
import { growCleaningSchema } from "./service.js";

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
      default: "google",
      trim: true,
    },
    photoURL: {
      type: String,
      default: "",
      trim: true,
    },
    growCleaning: {
      type: growCleaningSchema,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "users",
  },
);

const User = mongoose.models.User || mongoose.model("User", userSchema, "users");

export default User;
