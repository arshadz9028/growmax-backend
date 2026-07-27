import crypto from "crypto";
import { connectToDatabase } from "@/lib/mongodb";

import User from "@/models/User";

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

function userCode() {
  return crypto.randomBytes(8).toString("hex");
}

export async function POST(request) {
  try {
    await connectToDatabase();

    const body = await request.json();

    const {
      googleUid,
      username,
      email,
      photoURL,
    } = body;

    if (!googleUid)
      return Response.json(
        {
          success: false,
          message: "Google UID required",
        },
        { status: 400 }
      );

    if (!email)
      return Response.json(
        {
          success: false,
          message: "Email required",
        },
        { status: 400 }
      );

    let user = await User.findOne({
      email: email.toLowerCase(),
    });

    const secureToken = randomToken();

    const refreshToken = randomToken(64);

    const secureTokenExpiry =
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const refreshTokenExpiry =
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    if (!user) {
      user = await User.create({
        googleUid,

        username,

        email: email.toLowerCase(),

        photoURL,

        provider: "google",

        userProfile: {
          userToken: userCode(),

          secureToken,

          refreshToken,

          secureTokenExpiry,

          refreshTokenExpiry,
        },
      });
    } else {
      user.googleUid = googleUid;

      user.username = username;

      user.photoURL = photoURL;

      user.provider = "google";

      user.userProfile.secureToken =
        secureToken;

      user.userProfile.refreshToken =
        refreshToken;

      user.userProfile.secureTokenExpiry =
        secureTokenExpiry;

      user.userProfile.refreshTokenExpiry =
        refreshTokenExpiry;

      await user.save();
    }

    return Response.json({
      success: true,

      message: "Login successful",

      data: {
        id: user._id,

        username: user.username,

        email: user.email,

        photoURL: user.photoURL,

        userToken:
          user.userProfile.userToken,

        secureToken:
          user.userProfile.secureToken,

        refreshToken:
          user.userProfile.refreshToken,

        secureTokenExpiry:
          user.userProfile.secureTokenExpiry,

        refreshTokenExpiry:
          user.userProfile.refreshTokenExpiry,
      },
    });
  } catch (err) {
    console.error(err);

    return Response.json(
      {
        success: false,

        message: err.message,
      },
      {
        status: 500,
      }
    );
  }
}