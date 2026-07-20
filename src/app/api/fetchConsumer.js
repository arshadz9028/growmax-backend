import { connectToDatabase } from "../../lib/mongodb.js";
import GrowCleaningApplication from "../../models/service.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const consumerNumber = searchParams.get("consumerNumber");
    const userToken = searchParams.get("userToken");
    
    if (!consumerNumber || !userToken) {
      return jsonResponse(
        {
          success: false,
          message: "Consumer number and user token are required.",
        },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const application = await GrowCleaningApplication.findOne({
      consumerNumber: consumerNumber,
      "userProfile.userToken": userToken,
    });

    if (!application) {
      return jsonResponse(
        {
          success: false,
          message: "No application found matching this consumer number and user token.",
        },
        { status: 404 },
      );
    }

    return jsonResponse({
      success: true,
      data: application,
    });
  } catch (error) {
    console.error("Failed to fetch consumer data:", error);

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

