import { connectToDatabase } from "../../../lib/mongodb.js";
import GrowCleaningApplication from "../../../models/GrowCleaningApplication.js";
import SolarAMCApplication from "../../../models/SolarAMCApplication.js";
import Complaint from "../../../models/Complaint.js";
import { createNotification } from "../../../utils/notifications.js";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
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
    const statusParam = String(searchParams.get("status") || "pending").trim();

    await connectToDatabase();

    const statusQuery = { status: statusParam };

    const [growCleaning, solarAMC, complaints] = await Promise.all([
      GrowCleaningApplication.find(statusQuery).sort({ createdAt: -1 }).lean(),
      SolarAMCApplication.find(statusQuery).sort({ createdAt: -1 }).lean(),
      Complaint.find(statusQuery).sort({ createdAt: -1 }).lean(),
    ]);

    const normalize = (items = [], type = "unknown") =>
      (items || []).map((item) => ({ ...item, requestType: type }));

    const combined = [
      ...normalize(growCleaning, "grow-cleaning"),
      ...normalize(solarAMC, "solar-amc"),
      ...normalize(complaints, "complaint"),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return jsonResponse(
      {
        success: true,
        data: combined,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("Failed to fetch admin requests:", error);

    return jsonResponse(
      {
        success: false,
        message: "Unable to fetch requests right now.",
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }
}

export async function PATCH(request) {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname || "";
    const parts = pathname.split("/").filter(Boolean);
    const requestId = parts[parts.length - 1];

    if (!requestId) {
      return jsonResponse(
        {
          success: false,
          message: "Request identifier is required.",
        },
        { status: 400 }
      );
    }

    const payload = await request.json().catch(() => null);

    if (!payload || typeof payload !== "object") {
      return jsonResponse(
        {
          success: false,
          message: "No update payload provided.",
        },
        { status: 400 }
      );
    }

    // Normalize frontend status values
    const normalizedPayload = { ...payload };

    if (typeof normalizedPayload.status === "string") {
      const s = normalizedPayload.status.toLowerCase();

      if (s === "approved") {
        normalizedPayload.status = "contacted";
      }

      if (s === "rejected" || s === "reject") {
        normalizedPayload.status = "cancelled";
      }
    }

    await connectToDatabase();

    const models = [
      {
        model: GrowCleaningApplication,
        type: "grow-cleaning",
      },
      {
        model: SolarAMCApplication,
        type: "solar-amc",
      },
      {
        model: Complaint,
        type: "complaint",
      },
    ];

    let updated = null;
    let foundType = null;
    let originalDocument = null;

    /*
     * Find request
     */
    for (const entry of models) {
      const doc = await entry.model.findById(requestId);

      if (doc) {
        /*
         * Keep original values before updating.
         */
        originalDocument = doc.toObject
          ? doc.toObject()
          : { ...doc };

        /*
         * Update fields
         */
        Object.keys(normalizedPayload).forEach((key) => {
          if (normalizedPayload[key] !== undefined) {
            doc[key] = normalizedPayload[key];
          }
        });

        await doc.save();

        updated = doc.toObject
          ? doc.toObject()
          : doc;

        foundType = entry.type;

        break;
      }
    }

    /*
     * Request not found
     */
    if (!updated) {
      return jsonResponse(
        {
          success: false,
          message: "Request not found.",
        },
        { status: 404 }
      );
    }

    /*
     * =====================================================
     * CREATE CONSUMER NOTIFICATION
     * =====================================================
     *
     * Only for requests that belong to a consumer.
     *
     * Grow Cleaning / Solar AMC normally contain userId.
     *
     * Complaints can also be handled if they contain userId.
     */

    const previousStatus = originalDocument?.status;
    const newStatus = updated?.status;

    const statusChanged =
      previousStatus !== newStatus;

    if (statusChanged && updated?.userId) {
      try {
        let title = "Request Updated";
        let message = "Your service request has been updated.";
        let notificationType = "service";

        /*
         * APPROVED
         *
         * Your database internally converts:
         * approved -> contacted
         *
         * So we use the incoming admin status to determine
         * what notification should say.
         */

        const requestedStatus =
          typeof payload.status === "string"
            ? payload.status.toLowerCase()
            : "";

        if (
          requestedStatus === "approved" ||
          newStatus === "contacted"
        ) {
          title = "Request Approved";

          message = `Your ${
            updated.serviceName || foundType
          } request has been approved.`;

          notificationType = "approval";
        }

        /*
         * REJECTED
         */
        else if (
          requestedStatus === "rejected" ||
          requestedStatus === "reject" ||
          newStatus === "cancelled"
        ) {
          title = "Request Rejected";

          message = `Your ${
            updated.serviceName || foundType
          } request has been rejected.`;

          notificationType = "service";
        }

        /*
         * OTHER STATUS CHANGE
         */
        else {
          title = "Request Status Updated";

          message = `Your ${
            updated.serviceName || foundType
          } request status has been updated to ${newStatus}.`;
        }

        await createNotification({
          userId: updated.userId,

          recipientType: "consumer",

          title,

          message,

          type: notificationType,

          data: {
            requestId: updated._id,
            serviceName:
              updated.serviceName || foundType,

            requestType: foundType,

            previousStatus,

            status: newStatus,

            action: "view-request",
          },
        });

        console.log(
          `Consumer notification created for ${updated.userId}`
        );
      } catch (notificationError) {
        /*
         * Notification failure should NOT make the
         * Admin's request update fail.
         */
        console.error(
          "Failed to create consumer notification:",
          notificationError
        );
      }
    }

    /*
     * Return updated request
     */
    return jsonResponse(
      {
        success: true,
        message: "Request updated successfully.",
        data: {
          ...updated,
          requestType: foundType,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Failed to update admin request:",
      error
    );

    return jsonResponse(
      {
        success: false,
        message: "Unable to update request right now.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}