import mongoose from "mongoose";
import Notification from "../../../models/Notification.js";
import { createNotification } from "../../../utils/notifications.js";
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
 *
 * /api/notifications/technician?technicianId=TECHNICIAN_ID
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const technicianId = searchParams.get("technicianId");

    if (!technicianId) {
      return jsonResponse(
        {
          success: false,
          message: "technicianId is required",
        },
        400
      );
    }

    if (!mongoose.Types.ObjectId.isValid(technicianId)) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid technicianId",
        },
        400
      );
    }

    const notifications = await Notification.find({
      userId: technicianId,
      recipientType: "technician",
    })
      .sort({ createdAt: -1 })
      .lean();

    const unreadCount = await Notification.countDocuments({
      userId: technicianId,
      recipientType: "technician",
      isRead: false,
    });

    return jsonResponse({
      success: true,
      count: notifications.length,
      unreadCount,
      notifications,
    });
  } catch (error) {
    console.error("GET technician notifications error:", error);

    return jsonResponse(
      {
        success: false,
        message: "Failed to fetch technician notifications",
        error: error.message,
      },
      500
    );
  }
}

/**
 * POST
 *
 * /api/notifications/technician
 */
export async function POST(request) {
  try {
    const body = await request.json();

    const {
      technicianId,
      title,
      message,
      type = "general",
      data = {},
    } = body;

    if (!technicianId) {
      return jsonResponse(
        {
          success: false,
          message: "technicianId is required",
        },
        400
      );
    }

    if (!mongoose.Types.ObjectId.isValid(technicianId)) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid technicianId",
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
      userId: technicianId,
      recipientType: "technician",
      title: title.trim(),
      message: message.trim(),
      type,
      data,
      isRead: false,
    });

    return jsonResponse(
      {
        success: true,
        message: "Technician notification created successfully",
        notification,
      },
      201
    );
  } catch (error) {
    console.error("POST technician notification error:", error);

    return jsonResponse(
      {
        success: false,
        message: "Failed to create technician notification",
        error: error.message,
      },
      500
    );
  }
}

/**
 * PATCH
 */
export async function PATCH(request) {
  try {
    const body = await request.json();

    const {
      notificationId,
      technicianId,
      isRead,
      markAll = false,
    } = body;

    /*
     * Mark all as read
     */
    if (markAll === true) {
      if (!technicianId) {
        return jsonResponse(
          {
            success: false,
            message: "technicianId is required when markAll is true",
          },
          400
        );
      }

      if (!mongoose.Types.ObjectId.isValid(technicianId)) {
        return jsonResponse(
          {
            success: false,
            message: "Invalid technicianId",
          },
          400
        );
      }

      const result = await Notification.updateMany(
        {
          userId: technicianId,
          recipientType: "technician",
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
        message: "All technician notifications marked as read",
        modifiedCount: result.modifiedCount,
      });
    }

    /*
     * Mark one as read/unread
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
        recipientType: "technician",
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
          message: "Technician notification not found",
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
    console.error("PATCH technician notification error:", error);

    return jsonResponse(
      {
        success: false,
        message: "Failed to update technician notification",
        error: error.message,
      },
      500
    );
  }
}