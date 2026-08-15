import { connectToDatabase } from "../../../lib/mongodb.js";
import Technician from "../../../models/Technician.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

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

export async function PATCH(request) {
  try {
    await connectToDatabase();
    const url = new URL(request.url);
    const pathname = url.pathname || "";
    const pathParts = pathname.split("/").filter(Boolean);
    const payload = await request.json().catch(() => null);

    console.log("PATCH payload.", payload);

    if (!payload || typeof payload !== "object") {
      return jsonResponse(
        { success: false, message: "No payload provided." },
        { status: 400 },
      );
    }

    const rawTechnicianId =
      payload.technicianId ||
      payload.technician_id ||
      payload.techId ||
      (pathParts.length ? pathParts[pathParts.length - 1] : null) ||
      null;

    const technicianId =
      rawTechnicianId && /^[A-Fa-f0-9]{24}$/.test(String(rawTechnicianId))
        ? String(rawTechnicianId)
        : null;

    if (!technicianId) {
      return jsonResponse(
        { success: false, message: "Invalid or missing technicianId." },
        { status: 400 },
      );
    }

    let requestId =
      payload.requestId ||
      payload.appId ||
      payload.applicationId ||
      payload._requestId ||
      payload.visitId ||
      null;

    if (!requestId && pathParts.length > 1) {
      const lastSegment = pathParts[pathParts.length - 1];
      if (/^[A-Fa-f0-9]{24}$/.test(lastSegment) && lastSegment !== technicianId) {
        requestId = lastSegment;
      }
    }

    if (!requestId) {
      return jsonResponse(
        { success: false, message: "requestId is required." },
        { status: 400 },
      );
    }

    const visitIndex =
      payload.visitIndex ?? payload.visitIdx ?? payload.index ?? 0;

    const technician = await Technician.findById(technicianId);
    if (!technician) {
      return jsonResponse(
        { success: false, message: "Technician not found." },
        { status: 404 },
      );
    }

    const issueNote = String(
      payload.issueNote || payload.note || payload.message || "",
    ).trim();

    const existingIndex = (technician.assignedVisits || []).findIndex(
      (item) =>
        String(item.requestId) === String(requestId) &&
        Number(item.visitIndex) === Number(visitIndex),
    );

    if (existingIndex >= 0) {
      const existingVisit =
        technician.assignedVisits[existingIndex].toObject?.() ||
        technician.assignedVisits[existingIndex];

      technician.assignedVisits[existingIndex] = {
        ...existingVisit,
        issueNote,
        status: payload.status || existingVisit.status || "UpComing",
      };
    } else {
      technician.assignedVisits.push({
        requestId,
        visitIndex: Number(visitIndex) || 0,
        serviceName: payload.serviceName || "",
        consumerName: payload.consumerName || "",
        mobileNumber: payload.mobileNumber || "",
        dateOfVisit: payload.dateOfVisit ? new Date(payload.dateOfVisit) : null,
        location: payload.location || "",
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
        assignedAt: payload.assignedAt ? new Date(payload.assignedAt) : new Date(),
        status: payload.status || "UpComing",
        issueNote,
      });
    }

    technician.markModified && technician.markModified("assignedVisits");
    await technician.save();

    const safeTechnician = technician.toObject ? technician.toObject() : technician;
    delete safeTechnician.passwordHash;

    return jsonResponse(
      {
        success: true,
        message: "Issue recorded.",
        data: { technician: safeTechnician, requestId, visitIndex, issueNote },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to record issue:", error);
    return jsonResponse(
      {
        success: false,
        message: "Unable to record issue right now.",
        error: error.message,
      },
      { status: 500 },
    );
  }
}
