import mongoose from "mongoose";
import Notification from "../../../models/Notification.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * GET
 *
 * /api/notifications/unread-count
 *
 * Query:
 *
 * ?userId=USER_ID&recipientType=admin
 *
 * recipientType:
 * admin
 * consumer
 * technician
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const userId = searchParams.get("userId");
    const recipientType = searchParams.get("recipientType");

    if (!userId) {
      return jsonResponse(
        {
          success: false,
          message: "userId is required",
        },
        400
      );
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid userId",
        },
        400
      );
    }

    const allowedRecipientTypes = [
      "admin",
      "consumer",
      "technician",
    ];

    if (!recipientType) {
      return jsonResponse(
        {
          success: false,
          message: "recipientType is required",
        },
        400
      );
    }

    if (!allowedRecipientTypes.includes(recipientType)) {
      return jsonResponse(
        {
          success: false,
          message:
            "Invalid recipientType. Allowed values: admin, consumer, technician",
        },
        400
      );
    }

    const unreadCount = await Notification.countDocuments({
      userId,
      recipientType,
      isRead: false,
    });

    return jsonResponse({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.error("Unread notification count error:", error);

    return jsonResponse(
      {
        success: false,
        message: "Failed to get unread notification count",
        error: error.message,
      },
      500
    );
  }
}