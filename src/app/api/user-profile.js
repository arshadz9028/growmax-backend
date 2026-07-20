
import crypto from "crypto";
import { connectToDatabase } from "../../lib/mongodb.js";
import GrowCleaningApplication from "../../models/service.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
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
    const { userToken, userName, action } = payload;

    if (!userToken) {
      return jsonResponse(
        {
          success: false,
          message: "User token is required.",
        },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Find the application by user token
    const application = await GrowCleaningApplication.findOne({
      "userProfile.userToken": userToken,
    });

    if (!application) {
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
      application.userProfile.userName = userName || application.userProfile.userName;
      application.userProfile.secureToken = secureToken;
      application.userProfile.refreshToken = refreshToken;
      application.userProfile.secureTokenExpiry = secureTokenExpiry;
      application.userProfile.refreshTokenExpiry = refreshTokenExpiry;

      await application.save();

      return jsonResponse({
        success: true,
        message: "User profile created/updated successfully.",
        data: {
          secureToken,
          refreshToken,
          secureTokenExpiry,
          refreshTokenExpiry,
          userName: application.userProfile.userName,
          userToken: application.userProfile.userToken,
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
        application.userProfile.refreshToken !== providedRefreshToken ||
        !application.userProfile.refreshTokenExpiry ||
        new Date() > application.userProfile.refreshTokenExpiry
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

      application.userProfile.secureToken = newSecureToken;
      application.userProfile.refreshToken = newRefreshToken;
      application.userProfile.secureTokenExpiry = newSecureTokenExpiry;
      application.userProfile.refreshTokenExpiry = newRefreshTokenExpiry;

      await application.save();

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

    const application = await GrowCleaningApplication.findOne({
      "userProfile.secureToken": secureToken,
    });

    if (!application) {
      return jsonResponse(
        { success: false, message: "Invalid secure token." },
        { status: 404 }
      );
    }

    // Check if token is expired
    if (
      !application.userProfile.secureTokenExpiry ||
      new Date() > application.userProfile.secureTokenExpiry
    ) {
      return jsonResponse(
        { success: false, message: "Secure token expired. Please refresh or re-authenticate.", expired: true },
        { status: 401 }
      );
    }

    return jsonResponse({
      success: true,
      data: {
        userToken: application.userProfile.userToken,
        userName: application.userProfile.userName,
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
