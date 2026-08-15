import { connectToDatabase } from "../../../lib/mongodb.js";
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

    const query =
      statusParam === "open"
        ? { status: { $in: ["pending", "contacted"] } }
        : { status: statusParam };

    const complaints = await Complaint.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return jsonResponse(
      {
        success: true,
        data: complaints || [],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to fetch complaints:", error);

    return jsonResponse(
      {
        success: false,
        message: "Unable to fetch complaint requests right now.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname || "";
    const parts = pathname.split("/").filter(Boolean);
    const complaintId = parts[parts.length - 1];

    if (!complaintId) {
      return jsonResponse(
        { success: false, message: "Complaint identifier is required." },
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

    await connectToDatabase();

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return jsonResponse(
        { success: false, message: "Complaint not found." },
        { status: 404 }
      );
    }

    Object.keys(payload).forEach((key) => {
      if (payload[key] !== undefined) {
        complaint[key] = payload[key];
      }
    });

    // Normalize front-end status values to valid model values
    if (typeof complaint.status === "string") {
      const status = complaint.status.toLowerCase();
      if (status === "resolved") complaint.status = "resolved";
      else if (status === "rejected") complaint.status = "rejected";
      else if (status === "pending") complaint.status = "pending";
      else if (status === "cancelled") complaint.status = "cancelled";
      else if (status === "contacted") complaint.status = "contacted";
    }

    await complaint.save();

    return jsonResponse(
      {
        success: true,
        message: "Complaint updated successfully.",
        data: complaint.toObject ? complaint.toObject() : complaint,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to update complaint:", error);

    return jsonResponse(
      {
        success: false,
        message: "Unable to update complaint right now.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
