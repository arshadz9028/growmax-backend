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

/**
 * OPTIONS
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * GET
 *
 * GET /api/notifications/admin
 *
 * Query params:
 * ?adminId=ADMIN_ID
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const adminId = searchParams.get("adminId");

    if (!adminId) {
      return jsonResponse(
        {
          success: false,
          message: "adminId is required",
        },
        400
      );
    }

    if (!mongoose.Types.ObjectId.isValid(adminId)) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid adminId",
        },
        400
      );
    }

    const notifications = await Notification.find({
      recipientType: "admin",
    })
      .sort({ createdAt: -1 })
      .lean();

    const unreadCount = await Notification.countDocuments({
      recipientType: "admin",
      isRead: false,
    });

    return jsonResponse({
      success: true,
      count: notifications.length,
      unreadCount,
      notifications,
    });
  } catch (error) {
    console.error("GET admin notifications error:", error);

    return jsonResponse(
      {
        success: false,
        message: "Failed to fetch admin notifications",
        error: error.message,
      },
      500
    );
  }
}

/**
 * POST
 *
 * POST /api/notifications/admin
 *
 * Body:
 * {
 *   "adminId": "...",
 *   "title": "New Service Request",
 *   "message": "A new request has been submitted.",
 *   "type": "service",
 *   "data": {
 *      "requestId": "...",
 *      "action": "view-request"
 *   }
 * }
 */
export async function POST(request) {
  try {
    const body = await request.json();

    const {
      adminId,
      title,
      message,
      type = "general",
      data = {},
    } = body;

    if (!adminId) {
      return jsonResponse(
        {
          success: false,
          message: "adminId is required",
        },
        400
      );
    }

    if (!mongoose.Types.ObjectId.isValid(adminId)) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid adminId",
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
      userId: adminId,
      recipientType: "admin",
      title: title.trim(),
      message: message.trim(),
      type,
      data,
      isRead: false,
    });

    return jsonResponse(
      {
        success: true,
        message: "Admin notification created successfully",
        notification,
      },
      201
    );
  } catch (error) {
    console.error("POST admin notification error:", error);

    return jsonResponse(
      {
        success: false,
        message: "Failed to create admin notification",
        error: error.message,
      },
      500
    );
  }
}

/**
 * PATCH
 *
 * PATCH /api/notifications/admin
 *
 * Mark one notification:
 *
 * {
 *   "notificationId": "...",
 *   "isRead": true
 * }
 *
 * OR mark all:
 *
 * {
 *   "adminId": "...",
 *   "markAll": true
 * }
 */
export async function PATCH(request) {
  try {
    const body = await request.json();

    const {
      notificationId,
      adminId,
      isRead,
      markAll = false,
    } = body;

    /*
     * Mark ALL admin notifications as read
     */
    if (markAll === true) {
      if (!adminId) {
        return jsonResponse(
          {
            success: false,
            message: "adminId is required when markAll is true",
          },
          400
        );
      }

      if (!mongoose.Types.ObjectId.isValid(adminId)) {
        return jsonResponse(
          {
            success: false,
            message: "Invalid adminId",
          },
          400
        );
      }

      const result = await Notification.updateMany(
        {
          recipientType: "admin",
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
        message: "All admin notifications marked as read",
        modifiedCount: result.modifiedCount,
      });
    }

    /*
     * Mark ONE notification
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
        recipientType: "admin",
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
          message: "Admin notification not found",
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
    console.error("PATCH admin notification error:", error);

    return jsonResponse(
      {
        success: false,
        message: "Failed to update admin notification",
        error: error.message,
      },
      500
    );
  }
}