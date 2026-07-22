import { connectToDatabase } from "../../lib/mongodb.js";
import User from "../../models/user.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userToken = searchParams.get("userToken");
    // console.log("userToken:", userToken);
    if (!userToken) {
      return jsonResponse(
        {
          success: false,
          message: "User token is required.",
        },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const user = await User.findOne({
      "growCleaning.userProfile.userToken": userToken,
    });

    if (!user || !user.growCleaning) {
      return jsonResponse(
        {
          success: false,
          message: "No application found for this user token.",
        },
        { status: 404 },
      );
    }

    return jsonResponse({
      success: true,
      data: user.growCleaning,
    });
  } catch (error) {
    console.error("Failed to fetch user token data:", error);
    
    return jsonResponse(
      {
        success: false,
        message: "Unable to fetch the application data right now.",
        error: error.message,
      },
      { status: 500 },
    );
  }
}

