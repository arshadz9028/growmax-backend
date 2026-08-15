import { connectToDatabase } from "../../../lib/mongodb.js";
import GrowCleaningApplication from "../../../models/GrowCleaningApplication.js";
import Technician from "../../../models/Technician.js";

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
  return new Response(null, { status: 204, headers: corsHeaders });
}

function parseMonthKey(monthKey) {
  // monthKey expected in YYYY-MM format
  if (!monthKey) return null;
  const parts = String(monthKey).split("-");
  if (parts.length < 2) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  if (Number.isNaN(year) || Number.isNaN(month)) return null;
  return { year, month };
}

function resolveVisitReference(value, fallbackIndex = null) {
  if (value == null || value === "") return null;

  const str = String(value).trim();
  if (!str) return null;

  const normalized = str.replace(/^['"]|['"]$/g, "").trim();

  const directMatch = normalized.match(/^([A-Fa-f0-9]{24})-(\d+)$/);
  if (directMatch) {
    return { requestId: directMatch[1], visitIndex: parseInt(directMatch[2], 10), legacy: false };
  }

  const objectIdMatch = normalized.match(/^([A-Fa-f0-9]{24})$/);
  if (objectIdMatch) {
    return { requestId: objectIdMatch[1], visitIndex: fallbackIndex ?? 0, legacy: false };
  }

  const legacyVisitMatch = normalized.match(/^visit-(\d+)$/i);
  if (legacyVisitMatch) {
    return { requestId: null, visitIndex: parseInt(legacyVisitMatch[1], 10), legacy: true };
  }

  const combinedMatch = normalized.match(/([A-Fa-f0-9]{24})(?:-(\d+))?/);
  if (combinedMatch) {
    return { requestId: combinedMatch[1], visitIndex: parseInt(combinedMatch[2] ?? String(fallbackIndex ?? 0), 10), legacy: false };
  }

  return null;
}

async function findApplicationForLegacyVisitIndex(visitIndex, preferredRequestId = null) {
  const query = preferredRequestId ? { _id: preferredRequestId } : {};
  const applications = await GrowCleaningApplication.find(query);

  const matches = [];
  applications.forEach((app) => {
    const selectedVisits = app.consumerManagement && Array.isArray(app.consumerManagement.selectedVisits) ? app.consumerManagement.selectedVisits : [];
    if (visitIndex >= 0 && visitIndex < selectedVisits.length) {
      matches.push({ application: app, visitIndex });
    }
  });

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    return { ambiguous: true, matches };
  }
  return null;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthKey = searchParams.get("month") || "";
    const parsed = parseMonthKey(monthKey);

    await connectToDatabase();

    const applications = await GrowCleaningApplication.find({}).lean();

    const visits = [];

    applications.forEach((app) => {
      const selectedVisits = (app.consumerManagement && app.consumerManagement.selectedVisits) || [];
      selectedVisits.forEach((visit, idx) => {
        const date = visit && visit.date ? new Date(visit.date) : null;
        if (!date) return;
        if (parsed) {
          if (date.getFullYear() !== parsed.year || date.getMonth() !== parsed.month) return;
        }

        const assignmentStatus =
          visit.assignmentStatus ||
          (visit.assignedTechnicianId || visit.assignedTechnicianName || visit.assignedAt ? "assigned" : "unassigned");

        if (assignmentStatus === "assigned") {
          return;
        }

        visits.push({
          _visitId: `${app._id}-${idx}`,
          _visitIndex: idx,
          _date: date.toISOString(),
          _requestId: app._id,
          _mobileNumber: app.mobileNumber || app.phone || "",
          _consumerNumber: app.consumerNo || app.consumerNumber || "",
          _consumerName: app.fullName || "",
          _serviceName: app.serviceName || "",
          _address: app.address || "",
          _latitude: app.latitude ?? null,
          _longitude: app.longitude ?? null,
          _status: visit.status || "UpComing",
          _assignedTechnicianId: visit.assignedTechnicianId || null,
          _assignedTechnicianName: visit.assignedTechnicianName || "",
          _assignmentStatus: assignmentStatus,
          _assignedAt: visit.assignedAt || null,
        });
      });
    });

    // sort by date ascending
    visits.sort((a, b) => new Date(a._date) - new Date(b._date));
    console.log("visits",visits)
    return jsonResponse({ success: true, data: visits }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch visits:", error);
    return jsonResponse({ success: false, message: "Unable to fetch visits right now.", error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname || "";
    const searchParams = url.searchParams;

    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return jsonResponse({ success: false, message: "No payload provided." }, { status: 400 });
    }

    const routeVisitId =
      pathname.match(/\/api\/admin\/visits\/([^/]+)\/assign$/)?.[1] ||
      searchParams.get("visitId") ||
      searchParams.get("id") ||
      payload.visitId ||
      payload._visitId ||
      payload.apiId ||
      payload.requestId ||
      "";

    const requestIdFromBody = payload.requestId || payload.appId || payload.applicationId || payload._requestId || "";
    const visitIndexFromBody = payload.visitIndex ?? payload.index ?? null;

    const resolvedReference = resolveVisitReference(routeVisitId, visitIndexFromBody) ||
      resolveVisitReference(requestIdFromBody, visitIndexFromBody) ||
      (requestIdFromBody && visitIndexFromBody != null ? { requestId: requestIdFromBody, visitIndex: Number(visitIndexFromBody), legacy: false } : null);

    if (!resolvedReference) {
      return jsonResponse({ success: false, message: "Invalid visitId format." }, { status: 400 });
    }

    let requestId = String(resolvedReference.requestId || "").trim();
    let visitIndex = Number(resolvedReference.visitIndex ?? 0);

    await connectToDatabase();

    let application = null;
    if (requestId && /^[A-Fa-f0-9]{24}$/.test(requestId)) {
      application = await GrowCleaningApplication.findById(requestId);
    } else if (resolvedReference.legacy || requestId === "") {
      const fallbackMatch = await findApplicationForLegacyVisitIndex(visitIndex, requestIdFromBody || null);
      if (fallbackMatch && !fallbackMatch.ambiguous) {
        application = fallbackMatch.application;
        requestId = String(application._id);
      } else if (fallbackMatch && fallbackMatch.ambiguous) {
        return jsonResponse({ success: false, message: "Multiple visits match this identifier. Please send a valid application or requestId." }, { status: 400 });
      }
    }

    if (!application) {
      return jsonResponse({ success: false, message: "Request/application not found." }, { status: 404 });
    }

    const selected = application.consumerManagement && application.consumerManagement.selectedVisits;
    if (!Array.isArray(selected) || visitIndex < 0 || visitIndex >= selected.length) {
      return jsonResponse({ success: false, message: "Visit not found." }, { status: 404 });
    }

    const visit = selected[visitIndex];
    if (!visit.assignmentStatus) {
      visit.assignmentStatus = "unassigned";
    }
    if (visit.assignedTechnicianId == null && visit.assignedTechnicianName == null && visit.assignedAt == null) {
      visit.assignmentStatus = "unassigned";
    }

    const normalizeVisitStatus = (statusValue) => {
      if (statusValue == null || statusValue === "") return "UpComing";
      const value = String(statusValue).trim();
      const map = {
        assigned: "UpComing",
        Assigned: "UpComing",
        completed: "Completed",
        Completed: "Completed",
        pending: "Pending",
        Pending: "Pending",
        upcoming: "UpComing",
        Upcoming: "UpComing",
        UpComing: "UpComing",
      };
      return map[value] || value;
    };

    // apply allowed fields
    const allowedFields = [
      "technicianId",
      "technicianName",
      "assignedTechnicianId",
      "assignedTechnicianName",
      "assignedAt",
      "status",
      "assignmentStatus",
    ];

    allowedFields.forEach((key) => {
      if (payload[key] !== undefined) {
        if (key === "assignedTechnicianId" || key === "technicianId") {
          visit.assignedTechnicianId = payload[key];
        } else if (key === "assignedTechnicianName" || key === "technicianName") {
          visit.assignedTechnicianName = payload[key];
        } else if (key === "assignedAt") {
          visit.assignedAt = payload[key] ? new Date(payload[key]) : null;
        } else if (key === "status") {
          visit.status = normalizeVisitStatus(payload[key]);
        } else if (key === "assignmentStatus") {
          visit.assignmentStatus = payload[key] === "assigned" || payload[key] === "Assigned" ? "assigned" : "unassigned";
        }
      }
    });

    if (visit.assignedTechnicianId || visit.assignedTechnicianName || visit.assignedAt) {
      visit.assignmentStatus = "assigned";
    } else {
      visit.assignmentStatus = "unassigned";
    }

    if (visit.status === "Assigned") {
      visit.status = "UpComing";
    }

    const technicianId = visit.assignedTechnicianId || payload.assignedTechnicianId || payload.technicianId || null;
    if (technicianId) {
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
          assignedAt: visit.assignedAt || new Date(),
          status: visit.status || "UpComing",
        };

        const existingIndex = technician.assignedVisits.findIndex((item) =>
          String(item.requestId) === String(application._id) && Number(item.visitIndex) === Number(visitIndex)
        );

        if (existingIndex >= 0) {
          technician.assignedVisits[existingIndex] = { ...technician.assignedVisits[existingIndex].toObject?.() || technician.assignedVisits[existingIndex], ...visitRecord };
        } else {
          technician.assignedVisits.push(visitRecord);
        }

        technician.markModified && technician.markModified("assignedVisits");
        await technician.save();
      }
    }

    // ensure consumerManagement.selectedVisits updated in doc
    application.markModified && application.markModified("consumerManagement.selectedVisits");
    await application.save();

    return jsonResponse({ success: true, message: "Visit assigned.", data: { requestId, visitIndex, visit } }, { status: 200 });
  } catch (error) {
    console.error("Failed to assign visit:", error);
    return jsonResponse({ success: false, message: "Unable to assign visit right now.", error: error.message }, { status: 500 });
  }
}
