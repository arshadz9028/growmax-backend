import mongoose from "mongoose";
import Notification from "../../../models/Notification.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
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
 * /api/notifications/consumer?consumerId=USER_ID
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const consumerId = searchParams.get("consumerId");

    if (!consumerId) {
      return jsonResponse(
        {
          success: false,
          message: "consumerId is required",
        },
        400
      );
    }

    if (!mongoose.Types.ObjectId.isValid(consumerId)) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid consumerId",
        },
        400
      );
    }

    const notifications = await Notification.find({
      userId: consumerId,
      recipientType: "consumer",
    })
      .sort({ createdAt: -1 })
      .lean();

    const unreadCount = await Notification.countDocuments({
      userId: consumerId,
      recipientType: "consumer",
      isRead: false,
    });

    return jsonResponse({
      success: true,
      count: notifications.length,
      unreadCount,
      notifications,
    });
  } catch (error) {
    console.error("GET consumer notifications error:", error);

    return jsonResponse(
      {
        success: false,
        message: "Failed to fetch consumer notifications",
        error: error.message,
      },
      500
    );
  }
}

/**
 * POST
 *
 * Creates notification for consumer.
 *
 * POST /api/notifications/consumer
 */
export async function POST(request) {
  try {
    const body = await request.json();

    const {
      consumerId,
      title,
      message,
      type = "general",
      data = {},
    } = body;

    if (!consumerId) {
      return jsonResponse(
        {
          success: false,
          message: "consumerId is required",
        },
        400
      );
    }

    if (!mongoose.Types.ObjectId.isValid(consumerId)) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid consumerId",
        },
        400
      );
    }

    if (!title || !title.trim()) {
      return jsonResponse(
        {
          success: false,
          message: "title is required",
        },
        400
      );
    }

    if (!message || !message.trim()) {
      return jsonResponse(
        {
          success: false,
          message: "message is required",
        },
        400
      );
    }

    const allowedTypes = [
      "service",
      "payment",
      "order",
      "system",
      "approval",
      "general",
    ];

    if (!allowedTypes.includes(type)) {
      return jsonResponse(
        {
          success: false,
          message: `Invalid notification type. Allowed types: ${allowedTypes.join(
            ", "
          )}`,
        },
        400
      );
    }

    const notification = await Notification.create({
      userId: consumerId,
      recipientType: "consumer",
      title: title.trim(),
      message: message.trim(),
      type,
      data,
      isRead: false,
    });

    return jsonResponse(
      {
        success: true,
        message: "Consumer notification created successfully",
        notification,
      },
      201
    );
  } catch (error) {
    console.error("POST consumer notification error:", error);

    return jsonResponse(
      {
        success: false,
        message: "Failed to create consumer notification",
        error: error.message,
      },
      500
    );
  }
}

/**
 * PATCH
 *
 * Mark one notification as read/unread
 *
 * {
 *   "notificationId": "...",
 *   "isRead": true
 * }
 *
 * OR mark all:
 *
 * {
 *   "consumerId": "...",
 *   "markAll": true
 * }
 */
export async function PATCH(request) {
  try {
    const body = await request.json();

    const {
      notificationId,
      consumerId,
      isRead,
      markAll = false,
    } = body;

    /*
     * Mark all consumer notifications as read
     */
    if (markAll === true) {
      if (!consumerId) {
        return jsonResponse(
          {
            success: false,
            message: "consumerId is required when markAll is true",
          },
          400
        );
      }

      if (!mongoose.Types.ObjectId.isValid(consumerId)) {
        return jsonResponse(
          {
            success: false,
            message: "Invalid consumerId",
          },
          400
        );
      }

      const result = await Notification.updateMany(
        {
          userId: consumerId,
          recipientType: "consumer",
          isRead: false,
        },
        {
          $set: {
            isRead: true,
          },
        }
      );

      return jsonResponse({
        success: true,
        message: "All consumer notifications marked as read",
        modifiedCount: result.modifiedCount,
      });
    }

    /*
     * Mark one notification
     */
    if (!notificationId) {
      return jsonResponse(
        {
          success: false,
          message: "notificationId is required",
        },
        400
      );
    }

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid notificationId",
        },
        400
      );
    }

    if (typeof isRead !== "boolean") {
      return jsonResponse(
        {
          success: false,
          message: "isRead must be a boolean",
        },
        400
      );
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        recipientType: "consumer",
      },
      {
        $set: {
          isRead,
        },
      },
      {
        new: true,
      }
    ).lean();

    if (!notification) {
      return jsonResponse(
        {
          success: false,
          message: "Consumer notification not found",
        },
        404
      );
    }

    return jsonResponse({
      success: true,
      message: isRead
        ? "Notification marked as read"
        : "Notification marked as unread",
      notification,
    });
  } catch (error) {
    console.error("PATCH consumer notification error:", error);

    return jsonResponse(
      {
        success: false,
        message: "Failed to update consumer notification",
        error: error.message,
      },
      500
    );
  }
}