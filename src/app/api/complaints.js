import { connectToDatabase } from "../../lib/mongodb.js";
import Complaint from "../../models/Complaint.js";
import User from "../../models/user.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
    const userIdParam = searchParams.get("userId") || "";
    const lookupUserId = String(userIdParam).trim();

    if (!lookupUserId) {
      return jsonResponse(
        {
          success: false,
          message: "User identifier is required.",
        },
        {
          status: 400,
        }
      );
    }

    await connectToDatabase();

    let user = null;

    if (/^[a-fA-F0-9]{24}$/.test(lookupUserId)) {
      user = await User.findById(lookupUserId);
    } else {
      user = await User.findOne({ googleUid: lookupUserId });
    }

    if (!user) {
      return jsonResponse(
        {
          success: false,
          message: "User not found.",
        },
        {
          status: 404,
        }
      );
    }

    const complaints = await Complaint.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .lean();

    return jsonResponse(
      {
        success: true,
        data: complaints || [],
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("Failed to fetch complaints:", error);

    return jsonResponse(
      {
        success: false,
        message: "Unable to fetch complaints right now.",
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();

    if (!payload || typeof payload !== "object") {
      return jsonResponse(
        {
          success: false,
          message: "No complaint data was provided.",
        },
        {
          status: 400,
        }
      );
    }

    await connectToDatabase();

    let user = null;

    const lookupUserId = String(payload?.userId || "").trim();

    if (lookupUserId) {
      if (/^[a-fA-F0-9]{24}$/.test(lookupUserId)) {
        user = await User.findById(lookupUserId);
      } else {
        user = await User.findOne({ googleUid: lookupUserId });
      }
    }

    const complaintData = {
      serviceType: payload.serviceType || "complaint",
      userId: user?._id || null,
      consumerNo: String(payload.consumerNo || "").trim(),
      fullName: String(payload.fullName || "").trim(),
      phoneNumber: String(payload.phoneNumber || "").trim(),
      issueType: String(payload.issueType || "").trim(),
      description: String(payload.description || "").trim(),
      submittedAt: payload.submittedAt ? new Date(payload.submittedAt) : new Date(),
      status: "pending",
    };

    const requiredFields = [
      "consumerNo",
      "fullName",
      "phoneNumber",
      "issueType",
      "description",
    ];

    const missingFields = requiredFields.filter(
      (field) => !String(complaintData[field] || "").trim()
    );

    if (missingFields.length) {
      return jsonResponse(
        {
          success: false,
          message: "Validation failed.",
          errors: missingFields.map((field) => ({ field, message: "This field is required." })),
        },
        {
          status: 400,
        }
      );
    }

    const complaint = await Complaint.create(complaintData);

    return jsonResponse(
      {
        success: true,
        message: "Complaint submitted successfully.",
        data: {
          complaintId: complaint._id,
          status: complaint.status,
          submittedAt: complaint.submittedAt,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error("Failed to create complaint:", error);

    return jsonResponse(
      {
        success: false,
        message: "Unable to submit the complaint right now.",
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }
}
