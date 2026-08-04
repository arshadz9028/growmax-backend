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
    const userId = searchParams.get("userId");

    if (!userId) {
      return jsonResponse(
        {
          success: false,
          message: "userId is required.",
        },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const user = await User.findById(userId).lean();
    if (!user) {
      return jsonResponse(
        {
          success: false,
          message: "User not found.",
        },
        { status: 404 }
      );
    }

    return jsonResponse(
      {
        success: true,
        data: user?.service,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to fetch user:", error);

    return jsonResponse(
      {
        success: false,
        message: "Unable to fetch user right now.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
