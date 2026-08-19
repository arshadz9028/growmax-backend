import { connectToDatabase } from "../../../lib/mongodb.js";
import GrowCleaningApplication from "../../../models/GrowCleaningApplication.js";
import Technician from "../../../models/Technician.js";
import { createNotification } from "../../../utils/notifications.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

/**
 * Upload base64 image directly to Cloudinary.
 *
 * Same pattern used in grow-cleaning.js.
 */
async function uploadImageToCloudinary(base64Image, folder) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary configuration is missing.");
  }

  if (!base64Image || typeof base64Image !== "string") {
    throw new Error("Invalid image data provided.");
  }

  const formData = new FormData();

  formData.append("file", base64Image);

  formData.append("upload_preset", uploadPreset);

  formData.append("folder", folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result?.error?.message || "Cloudinary upload failed.");
  }

  return result.secure_url || result.url || "";
}

/**
 * OPTIONS
 */
export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * POST
 *
 * POST /api/admin/visits/:visitId/complete
 *
 * Expected JSON:
 *
 * {
 *   "requestId": "MONGODB_REQUEST_ID",
 *   "visitIndex": 0,
 *   "status": "Completed",
 *   "technicianId": "TECHNICIAN_ID",
 *   "technicianName": "Ahmed",
 *   "beforePhotoBase64": "data:image/jpeg;base64,...",
 *   "afterPhotoBase64": "data:image/jpeg;base64,..."
 * }
 */
export async function POST(request) {
  try {
    /*
     * =====================================================
     * GET VISIT ID FROM URL
     * =====================================================
     */

    const url = new URL(request.url);

    const pathname = url.pathname || "";

    const parts = pathname.split("/").filter(Boolean);

    const visitId = parts[parts.length - 1];

    if (!visitId) {
      return jsonResponse(
        {
          success: false,
          message: "visitId is required.",
        },
        {
          status: 400,
        },
      );
    }

    console.log("Received visit completion request:", visitId);

    /*
     * =====================================================
     * READ JSON BODY
     * =====================================================
     */

    const payload = await request.json().catch(() => null);

    if (!payload || typeof payload !== "object") {
      return jsonResponse(
        {
          success: false,
          message: "No request payload provided.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * =====================================================
     * RESOLVE REQUEST + VISIT INDEX
     * =====================================================
     */

    let requestId = payload.requestId || payload.request_id || null;

    let visitIndex =
      payload.visitIndex ?? payload.visitIdx ?? payload.index ?? null;

      console.log('visitIndex:', visitIndex);

    /*
     * Format:
     *
     * visitId = requestId-0
     */
    const directMatch = String(visitId).match(/^([A-Fa-f0-9]{24})-(\d+)$/);

    if (directMatch) {
      requestId = directMatch[1];

      visitIndex = parseInt(directMatch[2], 10);
    } else if (/^visit-(\d+)$/i.test(visitId)) {

    /*
     * Format:
     *
     * visit-0
     */
      visitIndex = parseInt(visitId.split("-")[1], 10);
    } else if (/^[A-Fa-f0-9]{24}$/.test(String(visitId))) {

    /*
     * Format:
     *
     * direct MongoDB request ID
     */
      requestId = visitId;
    }

    /*
     * Normalize visit index
     */
    if (visitIndex !== null && visitIndex !== undefined) {
      visitIndex = Number(visitIndex);
    }

    /*
     * =====================================================
     * VALIDATE REQUEST / VISIT
     * =====================================================
     */

    if (!requestId) {
      return jsonResponse(
        {
          success: false,
          message: "requestId is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (visitIndex === null || Number.isNaN(Number(visitIndex))) {
      return jsonResponse(
        {
          success: false,
          message: "visitIndex is required.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * =====================================================
     * CONNECT DATABASE
     * =====================================================
     */

    await connectToDatabase();

    /*
     * =====================================================
     * FIND APPLICATION
     * =====================================================
     */

    let application = await GrowCleaningApplication.findById(requestId);

    /*
     * If not found and visitId is legacy,
     * try resolving by visit index.
     */
    if (!application && /^visit-\d+$/i.test(visitId)) {
      const applications = await GrowCleaningApplication.find({});

      for (const appDoc of applications) {
        const selectedVisits = appDoc.consumerManagement?.selectedVisits;

        if (
          Array.isArray(selectedVisits) &&
          visitIndex >= 0 &&
          visitIndex < selectedVisits.length
        ) {
          application = appDoc;

          requestId = String(appDoc._id);

          break;
        }
      }
    }

    if (!application) {
      return jsonResponse(
        {
          success: false,
          message: "Request/application not found.",
        },
        {
          status: 404,
        },
      );
    }

    /*
     * =====================================================
     * GET SELECTED VISITS
     * =====================================================
     */

    const selectedVisits = application.consumerManagement?.selectedVisits;

    if (!Array.isArray(selectedVisits)) {
      return jsonResponse(
        {
          success: false,
          message: "No selected visits found.",
        },
        {
          status: 404,
        },
      );
    }

    if (visitIndex < 0 || visitIndex >= selectedVisits.length) {
      return jsonResponse(
        {
          success: false,
          message: "Visit not found.",
        },
        {
          status: 404,
        },
      );
    }

    const visit = selectedVisits[visitIndex];

    /*
     * =====================================================
     * RESOLVE TECHNICIAN
     * =====================================================
     */

    const technicianId = visit.assignedTechnicianId
      ? String(visit.assignedTechnicianId)
      : payload.assignedTechnicianId || payload.technicianId || null;

    const technicianName =
      visit.assignedTechnicianName ||
      payload.assignedTechnicianName ||
      payload.technicianName ||
      "Technician";

    console.log("Resolved technician:", {
      technicianId,
      technicianName,
    });

    /*
     * =====================================================
     * GET PHOTOS
     * =====================================================
     */

    const beforePhotoBase64 =
      payload.beforePhotoBase64 || payload.beforePhoto || null;

    const afterPhotoBase64 =
      payload.afterPhotoBase64 || payload.afterPhoto || null;

    if (!beforePhotoBase64) {
      return jsonResponse(
        {
          success: false,
          message: "beforePhotoBase64 is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (!afterPhotoBase64) {
      return jsonResponse(
        {
          success: false,
          message: "afterPhotoBase64 is required.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * =====================================================
     * UPLOAD PHOTOS TO CLOUDINARY
     * =====================================================
     */

    const folder = "grow_cleaning_visits";

    console.log("Uploading before photo...");

    const beforeUrl = await uploadImageToCloudinary(beforePhotoBase64, folder);

    console.log("Before photo uploaded:", beforeUrl);

    console.log("Uploading after photo...");

    const afterUrl = await uploadImageToCloudinary(afterPhotoBase64, folder);

    console.log("After photo uploaded:", afterUrl);

    /*
     * =====================================================
     * UPDATE APPLICATION VISIT
     * =====================================================
     */

    const status = payload.status || "Completed";

    visit.status = status;

    visit.beforePhotoUrl = beforeUrl;

    visit.afterPhotoUrl = afterUrl;

    visit.submittedAt = new Date();

    /*
     * Optional fields
     */
    if (technicianId) {
      visit.assignedTechnicianId = technicianId;
    }

    if (technicianName) {
      visit.assignedTechnicianName = technicianName;
    }

    /*
     * =====================================================
     * SAVE APPLICATION
     * =====================================================
     */

    application.markModified &&
      application.markModified("consumerManagement.selectedVisits");

    await application.save();

    console.log(
      "Application visit saved successfully:",
      application._id.toString(),
    );

    /*
     * =====================================================
     * UPDATE TECHNICIAN ASSIGNED VISIT
     * =====================================================
     */

    if (technicianId) {
      try {
        if (/^[A-Fa-f0-9]{24}$/.test(String(technicianId))) {
          const technician = await Technician.findById(technicianId);

          if (technician) {
            const visitRecord = {
              requestId: application._id,

              visitIndex,

              serviceName: application.serviceName || "",

              consumerName: application.fullName || "",

              mobileNumber: application.mobileNumber || application.phone || "",

              dateOfVisit: visit.date || null,

              location: application.address || "",

              latitude: application.latitude ?? null,

              longitude: application.longitude ?? null,

              beforePhotoUrl: beforeUrl,

              afterPhotoUrl: afterUrl,

              assignedAt: visit.assignedAt || new Date(),

              status: "In progress",
            };

            if (!Array.isArray(technician.assignedVisits)) {
              technician.assignedVisits = [];
            }

            const existingIndex = technician.assignedVisits.findIndex(
              (item) =>
                String(item.requestId) === String(application._id) &&
                Number(item.visitIndex) === Number(visitIndex),
            );

            if (existingIndex >= 0) {
              technician.assignedVisits[existingIndex] = {
                ...(technician.assignedVisits[existingIndex].toObject?.() ||
                  technician.assignedVisits[existingIndex]),

                ...visitRecord,
              };
            } else {
              technician.assignedVisits.push(visitRecord);
            }

            technician.markModified &&
              technician.markModified("assignedVisits");

            await technician.save();

            console.log(
              "Technician assigned visit updated:",
              technician._id.toString(),
            );
          } else {
            console.warn("Technician not found:", technicianId);
          }
        } else {
          console.warn("Invalid technician ID:", technicianId);
        }
      } catch (technicianError) {
        /*
         * Technician synchronization failure
         * should not fail the visit submission.
         */
        console.error(
          "Failed to update technician assigned visit:",
          technicianError,
        );
      }
    }

    /*
     * =====================================================
     * TECHNICIAN → ADMIN NOTIFICATION
     * =====================================================
     */

    try {
      console.log("Creating Admin notification...");

      const notification = await createNotification({
        recipientType: "admin",

        title: "Visit Submitted",

        message: `${technicianName} has submitted the ${
          application.serviceName || "service"
        } visit with before and after photos.`,

        type: "service",

        data: {
          requestId: String(application._id),

          visitIndex: Number(visitIndex),

          technicianId: technicianId ? String(technicianId) : null,

          technicianName,

          serviceName: application.serviceName || "",

          consumerName: application.fullName || "",

          consumerId: application.userId ? String(application.userId) : null,

          beforePhotoUrl: beforeUrl,

          afterPhotoUrl: afterUrl,

          status,

          submittedAt: visit.submittedAt,

          action: "view-visit",
        },
      });

      console.log("Admin notification created:", notification?._id);
    } catch (notificationError) {
      /*
       * Notification failure must not
       * make visit submission fail.
       */
      console.error("Failed to create Admin notification:", notificationError);
    }

    /*
     * =====================================================
     * RESPONSE
     * =====================================================
     */

    return jsonResponse(
      {
        success: true,

        message: "Visit submitted successfully.",

        data: {
          requestId,
          visitIndex,

          beforeUrl,
          afterUrl,

          technicianId,
          technicianName,

          submittedAt: visit.submittedAt,
        },
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("Failed to complete visit:", error);

    return jsonResponse(
      {
        success: false,
        message: "Unable to submit visit right now.",
        error: error.message,
      },
      {
        status: 500,
      },
    );
  }
}
