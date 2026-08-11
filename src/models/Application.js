// models/Application.js

import mongoose from "mongoose";

const ApplicationSchema = new mongoose.Schema(
  {
    fullName: String,

    mobileNumber: String,

    email: String,

    service: String,

    paymentMethod: String,

    location: {
      latitude: Number,
      longitude: Number,
      address: String,
    },

    images: [String],

    payment: {
      orderId: String,
      paymentId: String,
      signature: String,
      amount: Number,
      currency: String,
      status: {
        type: String,
        default: "SUCCESS",
      },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Application ||
  mongoose.model("Application", ApplicationSchema);