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

export async function REVIEW(request) {
  try {
    await connectToDatabase();

    const url = new URL(request.url);
    const pathname = url.pathname || "";
    const parts = pathname.split("/").filter(Boolean);
    const techIndex = parts.findIndex((p) => p === "technicians");
    const rawTechnicianId =
      (techIndex >= 0 && parts[techIndex + 1]) ||
      url.searchParams.get("technicianId") ||
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

    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return jsonResponse(
        { success: false, message: "No review payload provided." },
        { status: 400 },
      );
    }

    const requestId =
      payload.requestId ||
      payload.appId ||
      payload.applicationId ||
      payload._requestId ||
      null;

    const visitIndex =
      payload.visitIndex ?? payload.visitIdx ?? payload.index ?? null;

    const rawReviewStatus = String(payload.reviewStatus || payload.status || "")
      .trim()
      .toLowerCase();

    const validReviewStatus =
      rawReviewStatus === "approve" || rawReviewStatus === "approved"
        ? "approved"
        : rawReviewStatus === "reject" || rawReviewStatus === "rejected"
          ? "rejected"
          : null;

    if (!requestId) {
      return jsonResponse(
        { success: false, message: "requestId is required." },
        { status: 400 },
      );
    }

    if (visitIndex === null || Number.isNaN(Number(visitIndex))) {
      return jsonResponse(
        { success: false, message: "visitIndex is required." },
        { status: 400 },
      );
    }

    if (!validReviewStatus) {
      return jsonResponse(
        {
          success: false,
          message: "reviewStatus must be 'approved' or 'rejected'.",
        },
        { status: 400 },
      );
    }

    const technician = await Technician.findById(technicianId);
    if (!technician) {
      return jsonResponse(
        { success: false, message: "Technician not found." },
        { status: 404 },
      );
    }

    const visitIndexNumber = Number(visitIndex);
    const visitMatchIndex = (technician.assignedVisits || []).findIndex(
      (item) =>
        String(item.requestId) === String(requestId) &&
        Number(item.visitIndex) === visitIndexNumber,
    );

    if (visitMatchIndex < 0) {
      return jsonResponse(
        {
          success: false,
          message: "Assigned visit not found for this technician.",
        },
        { status: 404 },
      );
    }

    const existingVisit =
      technician.assignedVisits[visitMatchIndex].toObject?.() ||
      technician.assignedVisits[visitMatchIndex];

    technician.assignedVisits[visitMatchIndex] = {
      ...existingVisit,
      reviewStatus: validReviewStatus,
      reviewedAt: payload.reviewedAt ? new Date(payload.reviewedAt) : new Date(),
      status:
        validReviewStatus === "approved"
          ? existingVisit.status || "Completed"
          : existingVisit.status || "UpComing",
    };

    technician.markModified && technician.markModified("assignedVisits");
    await technician.save();

    return jsonResponse(
      {
        success: true,
        message: `Visit ${validReviewStatus}.`,
        data: {
          technicianId,
          requestId,
          visitIndex: visitIndexNumber,
          reviewStatus: validReviewStatus,
          reviewedAt: technician.assignedVisits[visitMatchIndex].reviewedAt,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to review technician visit:", error);
    return jsonResponse(
      {
        success: false,
        message: "Unable to update review status right now.",
        error: error.message,
      },
      { status: 500 },
    );
  }
}

export async function GET(request) {
  try {
    await connectToDatabase();

    const url = new URL(request.url);
    const rawTechnicianId =
      url.searchParams.get("technicianId") ||
      url.pathname.split("/").filter(Boolean).pop();
    const technicianId =
      rawTechnicianId && /^[A-Fa-f0-9]{24}$/.test(rawTechnicianId)
        ? rawTechnicianId
        : null;

    if (technicianId) {
      const technician = await Technician.findById(technicianId).lean();
      if (!technician) {
        return jsonResponse(
          { success: false, message: "Technician not found." },
          { status: 404 },
        );
      }

      return jsonResponse(
        { success: true, data: technician.assignedVisits || [] },
        { status: 200 },
      );
    }

    const technicians = await Technician.find({ active: true })
      .sort({ name: 1 })
      .lean();
    console.log("Fetched technicians:", technicians);
    return jsonResponse(
      { success: true, data: technicians || [] },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to fetch technicians:", error);
    return jsonResponse(
      {
        success: false,
        message: "Unable to fetch technicians right now.",
        error: error.message,
      },
      { status: 500 },
    );
  }
}

export async function LOGIN(request, providedPayload = null) {
  try {
    const payload = providedPayload || (await request.json().catch(() => null));
    if (!payload || typeof payload !== "object") {
      return jsonResponse(
        { success: false, message: "No login data provided." },
        { status: 400 },
      );
    }

    const username = String(payload.username || "").trim();
    const password = String(payload.password || "");

    if (!username || !password) {
      return jsonResponse(
        {
          success: false,
          message: "Username and password are required.",
        },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const technician = await Technician.findOne({
      $or: [
        { username },
        { email: username.toLowerCase() },
        { mobileNumber: username },
      ],
    });

    if (!technician) {
      return jsonResponse(
        { success: false, message: "Invalid username or password." },
        { status: 401 },
      );
    }

    const isPasswordValid =
      technician.passwordHash &&
      (await bcrypt.compare(password, technician.passwordHash));

    if (!isPasswordValid) {
      return jsonResponse(
        { success: false, message: "Invalid username or password." },
        { status: 401 },
      );
    }

    if (!technician.active) {
      return jsonResponse(
        {
          success: false,
          message: "Your account is inactive. Please contact support.",
        },
        { status: 403 },
      );
    }

    if (technician.role && technician.role !== "technician") {
      return jsonResponse(
        {
          success: false,
          message: "This portal is for technicians only.",
        },
        { status: 403 },
      );
    }

    const jwtSecret = process.env.JWT_SECRET || "growmax-tech-secret";
    const token = jwt.sign(
      {
        userId: technician._id.toString(),
        username: technician.username || technician.name,
        role: technician.role || "technician",
      },
      jwtSecret,
      { expiresIn: "365d" },
    );

    const safeTechnician = technician.toObject
      ? technician.toObject()
      : technician;
    delete safeTechnician.passwordHash;

    return jsonResponse(
      {
        success: true,
        message: "Login successful.",
        data: {
          technician: safeTechnician,
          token,
          userToken: token,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to login technician:", error);
    return jsonResponse(
      {
        success: false,
        message: "Unable to login right now.",
        error: error.message,
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request) {
  try {
    await connectToDatabase();
    const url = new URL(request.url);
    const pathname = url.pathname || "";
    const parts = pathname.split("/").filter(Boolean);
    const techIndex = parts.findIndex((p) => p === "technicians");
    const rawTechnicianId =
      (techIndex >= 0 && parts[techIndex + 1]) ||
      url.searchParams.get("visitId");
    console.log("rawTechnicianId:", rawTechnicianId);
    const technicianId =
      rawTechnicianId && /^[A-Fa-f0-9]{24}$/.test(rawTechnicianId)
        ? rawTechnicianId
        : null;

    if (!technicianId) {
      return jsonResponse(
        { success: false, message: "Invalid or missing technicianId." },
        { status: 400 },
      );
    }

    const payload = await request.json().catch(() => null);
       console.log("PATCH payload.", payload);

    if (!payload || typeof payload !== "object") {
      return jsonResponse(
        { success: false, message: "No payload provided." },
        { status: 400 },
      );
    }

    // Resolve requestId and visitIndex from payload
    let requestId =
      payload.requestId ||
      payload.appId ||
      payload.applicationId ||
      payload._requestId ||
      null;
   

    if (!requestId) {
      return jsonResponse(
        { success: false, message: "requestId is required." },
        { status: 400 },
      );
    }
   

    const technician = await Technician.findById(technicianId);
    if (!technician) {
      return jsonResponse(
        { success: false, message: "Technician not found." },
        { status: 404 },
      );
    }
    console.log("Found technician:", technician);
 
    
      // push a minimal record so technician will see the issue
    //   technician.assignedVisits.push({
    //     requestId,
    //     visitIndex,
    //     serviceName: application.serviceName || "",
    //     consumerName: application.fullName || "",
    //     mobileNumber: application.mobileNumber || application.phone || "",
    //     dateOfVisit: selected[visitIndex].date || null,
    //     location: application.address || "",
    //     latitude: application.latitude ?? null,
    //     longitude: application.longitude ?? null,
    //     assignedAt: selected[visitIndex].assignedAt || new Date(),
    //     status: payload.status || "Service/Installation Pending",
    //     issueNote: issueNoteVal || "",
    //   });
    

    // technician.markModified && technician.markModified("assignedVisits");
    // await technician.save();

    // const safeTechnician = technician.toObject
    //   ? technician.toObject()
    //   : technician;
    // delete safeTechnician.passwordHash;

    return jsonResponse(
      {
        success: true,
        message: "Issue recorded.",
        data: { technician: safeTechnician, requestId, visitIndex },
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

export async function POST(request) {
  try {
    const payload = await request.json().catch(() => null);
    console.log("Received technician payload:", payload);
    if (!payload || typeof payload !== "object") {
      return jsonResponse(
        { success: false, message: "No technician data provided." },
        { status: 400 },
      );
    }

    const hasLoginFields =
      payload.username &&
      payload.password &&
      !payload.fullName &&
      !payload.name;
    if (hasLoginFields) {
      return LOGIN(request, payload);
    }

    const fullName = String(payload.fullName || payload.name || "").trim();
    const username = String(payload.username || fullName || "").trim();
    const mobileNumber = String(
      payload.mobileNumber || payload.phone || "",
    ).trim();
    const email = String(payload.email || "")
      .trim()
      .toLowerCase();
    const city = String(payload.city || "").trim();
    const password = String(payload.password || "");
    const role = String(payload.role || "technician").trim();
    const active =
      payload.active === undefined ? true : Boolean(payload.active);

    if (!fullName) {
      return jsonResponse(
        { success: false, message: "Technician fullName is required." },
        { status: 400 },
      );
    }

    await connectToDatabase();

    // prevent duplicate technician by email or mobile
    const conflictQuery = [];
    if (email) conflictQuery.push({ email });
    if (mobileNumber) conflictQuery.push({ mobileNumber });

    if (conflictQuery.length) {
      const existing = await Technician.findOne({ $or: conflictQuery });
      if (existing) {
        return jsonResponse(
          {
            success: false,
            message: "Technician with this email or mobile already exists.",
          },
          { status: 409 },
        );
      }
    }

    const passwordHash = password ? await bcrypt.hash(password, 10) : "";

    const tech = await Technician.create({
      name: fullName,
      username,
      mobileNumber,
      email,
      city,
      passwordHash,
      role,
      active,
    });

    const responseData = { ...tech.toObject() };
    delete responseData.passwordHash;

    return jsonResponse(
      { success: true, message: "Technician created.", data: responseData },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create technician:", error);
    return jsonResponse(
      {
        success: false,
        message: "Unable to create technician right now.",
        error: error.message,
      },
      { status: 500 },
    );
  }
}
