
import crypto from "crypto";
import { connectToDatabase } from "../../lib/mongodb.js";
import User from "../../models/user.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(body, init = {}) {
  return Response.json(body, {
    ...init,
    headers: {
      ...corsHeaders,
      ...(init.headers || {}),
    },
  });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString("hex");
}

function generateRefreshToken(length = 64) {
  return crypto.randomBytes(length).toString("hex");
}

// POST: Create or update user profile
export async function POST(request) {
  try {
    const payload = await request.json();
    const {
      userToken,
      userName,
      action,
      googleUid,
      email,
      photoURL,
      username,
    } = payload;
    console.log("Received payload:", payload);
    await connectToDatabase();

    if (action === "login" || action === "upsert") {
      if (!email) {
        return jsonResponse(
          {
            success: false,
            message: "Google email is required.",
          },
          { status: 400 }
        );
      }

      const sanitizedEmail = String(email).toLowerCase();
      // const loginUser = await User.findOneAndUpdate(
      //   { email: sanitizedEmail },
      //   {
      //     $set: {
      //       googleUid: googleUid || "",
      //       email: sanitizedEmail,
      //       username: username || userName || "",
      //       photoURL: photoURL || "",
      //       provider: "google",
      //     },
      //   },
      //   {
      //     new: true,
      //     upsert: true,
      //     setDefaultsOnInsert: true,
      //   },
      // );
let loginUser = await User.findOne({
    email: sanitizedEmail,
});

if (!loginUser) {
    loginUser = new User({
        email: sanitizedEmail,
        username: username || userName || "",
        googleUid,
        photoURL,
        provider: "google",
    });
}

      return jsonResponse({
        success: true,
        message: "Google user synced successfully.",
        data: {
          id: loginUser._id,
          email: loginUser.email,
          username: loginUser.username,
          googleUid: loginUser.googleUid,
        },
      });
    }

    if (!userToken) {
      return jsonResponse(
        {
          success: false,
          message: "User token is required.",
        },
        { status: 400 }
      );
    }

    const user = await User.findOne({
      "growCleaning.userProfile.userToken": userToken,
    });

    if (!user || !user.growCleaning) {
      return jsonResponse(
        {
          success: false,
          message: "No application found for this user token.",
        },
        { status: 404 }
      );
    }

    if (action === "create" || action === "update") {
      // Generate new tokens
      const secureToken = generateSecureToken();
      const refreshToken = generateRefreshToken();
      const secureTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const refreshTokenExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      // Update the application
      user.username = userName || user.username || user.growCleaning.userProfile.userName;
      user.growCleaning.userProfile.userName = userName || user.growCleaning.userProfile.userName;
      user.growCleaning.userProfile.secureToken = secureToken;
      user.growCleaning.userProfile.refreshToken = refreshToken;
      user.growCleaning.userProfile.secureTokenExpiry = secureTokenExpiry;
      user.growCleaning.userProfile.refreshTokenExpiry = refreshTokenExpiry;

      await user.save();

      return jsonResponse({
        success: true,
        message: "User profile created/updated successfully.",
        data: {
          secureToken,
          refreshToken,
          secureTokenExpiry,
          refreshTokenExpiry,
          userName: user.growCleaning.userProfile.userName,
          userToken: user.growCleaning.userProfile.userToken,
        },
      });
    } else if (action === "refresh") {
      const { refreshToken: providedRefreshToken } = payload;

      if (!providedRefreshToken) {
        return jsonResponse(
          { success: false, message: "Refresh token is required." },
          { status: 400 }
        );
      }

      // Check if refresh token matches and is not expired
      if (
        user.growCleaning.userProfile.refreshToken !== providedRefreshToken ||
        !user.growCleaning.userProfile.refreshTokenExpiry ||
        new Date() > user.growCleaning.userProfile.refreshTokenExpiry
      ) {
        return jsonResponse(
          { success: false, message: "Invalid or expired refresh token. Please re-enter username to regenerate." },
          { status: 401 }
        );
      }

      // Generate new tokens
      const newSecureToken = generateSecureToken();
      const newRefreshToken = generateRefreshToken();
      const newSecureTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const newRefreshTokenExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      user.growCleaning.userProfile.secureToken = newSecureToken;
      user.growCleaning.userProfile.refreshToken = newRefreshToken;
      user.growCleaning.userProfile.secureTokenExpiry = newSecureTokenExpiry;
      user.growCleaning.userProfile.refreshTokenExpiry = newRefreshTokenExpiry;

      await user.save();

      return jsonResponse({
        success: true,
        message: "Tokens refreshed successfully.",
        data: {
          secureToken: newSecureToken,
          refreshToken: newRefreshToken,
          secureTokenExpiry: newSecureTokenExpiry,
          refreshTokenExpiry: newRefreshTokenExpiry,
        },
      });
    } else {
      return jsonResponse(
        { success: false, message: "Invalid action." },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Failed to manage user profile:", error);
    return jsonResponse(
      {
        success: false,
        message: "Unable to manage user profile right now.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

// GET: Verify secure token
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const secureToken = searchParams.get("secureToken");

    if (!secureToken) {
      return jsonResponse(
        { success: false, message: "Secure token is required." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const user = await User.findOne({
      "growCleaning.userProfile.secureToken": secureToken,
    });

    if (!user || !user.growCleaning) {
      return jsonResponse(
        { success: false, message: "Invalid secure token." },
        { status: 404 }
      );
    }

    // Check if token is expired
    if (
      !user.growCleaning.userProfile.secureTokenExpiry ||
      new Date() > user.growCleaning.userProfile.secureTokenExpiry
    ) {
      return jsonResponse(
        { success: false, message: "Secure token expired. Please refresh or re-authenticate.", expired: true },
        { status: 401 }
      );
    }

    return jsonResponse({
      success: true,
      data: {
        userToken: user.growCleaning.userProfile.userToken,
        userName: user.growCleaning.userProfile.userName,
      },
    });
  } catch (error) {
    console.error("Failed to verify secure token:", error);
    return jsonResponse(
      {
        success: false,
        message: "Unable to verify token right now.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
