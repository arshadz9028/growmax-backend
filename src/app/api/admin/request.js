import { connectToDatabase } from "../../../lib/mongodb.js";
import GrowCleaningApplication from "../../../models/GrowCleaningApplication.js";
import SolarAMCApplication from "../../../models/SolarAMCApplication.js";
import Complaint from "../../../models/Complaint.js";

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
        { success: false, message: "Request identifier is required." },
        { status: 400 }
      );
    }

    const payload = await request.json().catch(() => null);

    if (!payload || typeof payload !== "object") {
      return jsonResponse(
        { success: false, message: "No update payload provided." },
        { status: 400 }
      );
    }

    // Normalize front-end status values to model enums to avoid validation errors
    const normalizedPayload = { ...payload };
    if (typeof normalizedPayload.status === "string") {
      const s = normalizedPayload.status.toLowerCase();
      if (s === "approved") normalizedPayload.status = "contacted";
      if (s === "rejected" || s === "reject") normalizedPayload.status = "cancelled";
    }

    await connectToDatabase();

    const models = [
      { model: GrowCleaningApplication, type: "grow-cleaning" },
      { model: SolarAMCApplication, type: "solar-amc" },
      { model: Complaint, type: "complaint" },
    ];

    let updated = null;
    let foundType = null;

    for (const entry of models) {
      const doc = await entry.model.findById(requestId);
      if (doc) {
        Object.keys(normalizedPayload).forEach((key) => {
          // only set defined values
          if (normalizedPayload[key] !== undefined) {
            doc[key] = normalizedPayload[key];
          }
        });

        await doc.save();
        updated = doc.toObject ? doc.toObject() : doc;
        foundType = entry.type;
        break;
      }
    }

    if (!updated) {
      return jsonResponse(
        { success: false, message: "Request not found." },
        { status: 404 }
      );
    }

    return jsonResponse(
      {
        success: true,
        message: "Request updated successfully.",
        data: { ...updated, requestType: foundType },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to update admin request:", error);

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
