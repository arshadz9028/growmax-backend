import { connectToDatabase } from "../../lib/mongodb.js";
import SolarAMCApplication from "../../models/SolarAMCApplication.js";
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
    const emailParam = searchParams.get("email") || "";
    const lookupUserId = String(userIdParam).trim();
    const lookupEmail = String(emailParam).trim().toLowerCase();

    if (!lookupUserId && !lookupEmail) {
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

    if (lookupUserId) {
      if (/^[a-fA-F0-9]{24}$/.test(lookupUserId)) {
        user = await User.findById(lookupUserId);
      } else {
        const fallbackQuery = [{ googleUid: lookupUserId }];

        if (lookupEmail) {
          fallbackQuery.push({ email: lookupEmail });
        }

        user = await User.findOne({ $or: fallbackQuery });
      }
    } else if (lookupEmail) {
      user = await User.findOne({ email: lookupEmail });
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

    const applications = await SolarAMCApplication.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .lean();

    return jsonResponse(
      {
        success: true,
        data: applications || [],
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("Failed to fetch solar AMC applications:", error);

    return jsonResponse(
      {
        success: false,
        message: "Unable to fetch applications right now.",
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
          message: "No application data was provided.",
        },
        {
          status: 400,
        }
      );
    }

    await connectToDatabase();

    let user = null;

    const lookupEmail = String(payload?.email || "")
      .trim()
      .toLowerCase();

    if (payload?.userId) {
      const userIdValue = String(payload.userId).trim();

      if (/^[a-fA-F0-9]{24}$/.test(userIdValue)) {
        user = await User.findById(userIdValue);
      } else {
        const fallbackQuery = [];

        if (userIdValue) {
          fallbackQuery.push({ googleUid: userIdValue });
        }

        if (lookupEmail) {
          fallbackQuery.push({ email: lookupEmail });
        }

        if (fallbackQuery.length) {
          user = await User.findOne({ $or: fallbackQuery });
        }
      }
    } else if (lookupEmail) {
      user = await User.findOne({ email: lookupEmail });
    }

    const applicationData = {
      serviceType: payload.serviceType || "solar-amc",
      userId: user?._id || null,
      consumerNo: String(payload.consumerNo || "").trim(),
      consumerName: String(payload.consumerName || "").trim(),
      consumerAddress: String(payload.consumerAddress || "").trim(),
      landmark: String(payload.landmark || "").trim(),
      primaryPhone: String(payload.primaryPhone || payload.whatsappNumber || "").trim(),
      secondaryPhone: String(payload.secondaryPhone || "").trim(),
      whatsappNumber: String(payload.whatsappNumber || payload.primaryPhone || "").trim(),
      email: String(payload.email || "").trim().toLowerCase(),
      solarCapacityKw: String(payload.solarCapacityKw || "").trim(),
      latitude: String(payload.latitude || "").trim(),
      longitude: String(payload.longitude || "").trim(),
      connectionType: String(payload.connectionType || "").trim(),
      phase: String(payload.phase || "").trim(),
      submittedAt: payload.submittedAt ? new Date(payload.submittedAt) : new Date(),
      status: "pending",
    };

    const requiredFields = [
      "consumerNo",
      "consumerName",
      "consumerAddress",
      "primaryPhone",
      "email",
      "solarCapacityKw",
      "connectionType",
      "phase",
    ];

    const missingFields = requiredFields.filter((field) => !String(applicationData[field] || "").trim());

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

    const application = await SolarAMCApplication.create(applicationData);

    if (user) {
      const services = Array.isArray(user.service) ? user.service : [];
      const existingService = services.find(
        (item) => item && String(item.name || "").toLowerCase() === "solar amc"
      );

      if (existingService) {
        existingService.reg_date = new Date();
        existingService.active = false;
      } else {
        services.push({ name: "Solar AMC", reg_date: new Date(), active: false });
      }

      user.service = services;
      await user.save();
    }

    return jsonResponse(
      {
        success: true,
        message: "Solar AMC application submitted successfully.",
        data: {
          applicationId: application._id,
          status: application.status,
          submittedAt: application.submittedAt,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error("Failed to create solar AMC application:", error);

    return jsonResponse(
      {
        success: false,
        message: "Unable to submit the application right now.",
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }
}
