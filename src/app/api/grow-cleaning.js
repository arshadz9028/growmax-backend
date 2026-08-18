import crypto from "crypto";
import { validateGrowCleaningPayload } from "../../lib/growCleaningValidation.js";
import { connectToDatabase } from "../../lib/mongodb.js";
import GrowCleaningApplication from "../../models/GrowCleaningApplication.js";
import User from "../../models/user.js";
import { createNotification } from "../../utils/notifications.js";
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

/**
 * Generates a unique 10-character alphanumeric token.
 * Example:
 * A8K2M9X4QP
 * 9DF2HJ8KLM
 */
function normalizeSelectedVisits(selectedVisits = []) {
  if (!Array.isArray(selectedVisits)) {
    return [];
  }

  return selectedVisits
    .filter((visit) => visit && typeof visit === "object")
    .map((visit) => ({
      date: visit.date || null,
      status: visit.status || "UpComing",
      assignedTechnicianId: visit.assignedTechnicianId ?? null,
      assignedTechnicianName: visit.assignedTechnicianName || "",
      assignmentStatus: visit.assignmentStatus || (visit.assignedTechnicianId ? "assigned" : "unassigned"),
      assignedAt: visit.assignedAt || null,
    }))
    .filter((visit) => visit.date);
}

function buildConsumerManagement(selectedVisits = []) {
  const normalizedVisits = normalizeSelectedVisits(selectedVisits);

  return {
    userCode: "",
    totalVisit: normalizedVisits.length || 14,
    markedVisit: normalizedVisits.length,
    remainingVisit: Math.max(14 - normalizedVisits.length, 0),
    selectedVisits: normalizedVisits,
  };
}

async function uploadImageToCloudinary(base64Image) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary configuration is missing.");
  }

  const formData = new FormData();
  formData.append("file", base64Image);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", "grow_cleaning_applications");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result?.error?.message || "Cloudinary upload failed.");
  }

  return result.secure_url || result.url || "";
}

async function registerUserService(user, serviceName = "Solar Cleaning") {
  if (!user || !serviceName) {
    return;
  }

  const normalizedName = String(serviceName).trim();

  if (!normalizedName) {
    return;
  }

  const services = Array.isArray(user.service) ? user.service : [];
  const existingService = services.find(
    (item) => item && String(item.name || "").toLowerCase() === normalizedName.toLowerCase()
  );

  if (existingService) {
    existingService.reg_date = new Date();
    existingService.active = false;
  } else {
    services.push({
      name: normalizedName,
      reg_date: new Date(),
      active: false,
    });
  }

  user.service = services;
  await user.save();
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

        user = await User.findOne({
          $or: fallbackQuery,
        });
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

    const applications = await GrowCleaningApplication.find({
      userId: user._id,
    })
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
    console.error("Failed to fetch grow cleaning applications:", error);

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
    console.log("Received payload:", payload);
    const requestItems = Array.isArray(payload?.requests)
      ? payload.requests
      : [payload];

    if (!requestItems.length) {
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
    const lookupEmail = String(
      payload?.email || requestItems[0]?.email || ""
    )
      .trim()
      .toLowerCase();

    if (payload?.userId) {
      console.log("Looking up user by userId:", payload.userId);
      const userIdValue = String(payload.userId).trim();

      if (/^[a-fA-F0-9]{24}$/.test(userIdValue)) {
        user = await User.findById(userIdValue);
        console.log("Looking up use1111:", user);

      } else {
        const fallbackQuery = [];

        if (userIdValue) {
          fallbackQuery.push({ googleUid: userIdValue });
        }

        if (lookupEmail) {
          fallbackQuery.push({ email: lookupEmail });
        }

        if (fallbackQuery.length) {
          user = await User.findOne({
            $or: fallbackQuery,
          });
        }
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

    const createdApplications = [];

    for (const requestItem of requestItems) {
      const itemPayload = requestItem || {};
      const resolvedServiceName = String(
        itemPayload.serviceName || payload?.serviceName || "Solar Cleaning"
      ).trim() || "Solar Cleaning";
      const { data, errors, isValid } = validateGrowCleaningPayload({
        ...payload,
        ...itemPayload,
      });

      if (!isValid) {
        return jsonResponse(
          {
            success: false,
            message: "Validation failed.",
            errors,
          },
          {
            status: 400,
          }
        );
      }

      let sitePhotoUrl = "";

      if (data.sitePhotoBase64) {
        sitePhotoUrl = await uploadImageToCloudinary(
          data.sitePhotoBase64
        );
      }

      const application = await GrowCleaningApplication.create({
        userId: user._id,

        fullName: data.fullName,
        mobileNumber: data.mobileNumber,
        email: itemPayload.email || user.email,
        address: data.address,
        city: data.city,

        serviceName: resolvedServiceName,
        totalAmount: Number(itemPayload.totalAmount) || 0,
        consumerNumber: data.consumerNumber || "",
        consumerNo: data.consumerNo || data.consumerNumber || "",
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        locationAddress: data.locationAddress,
        landmark: data.landmark || "",
        sitePhotoUrl,
        agreedToTerms: data.agreedToTerms,
        paymentMethod: data.paymentMethod,
        transactionId: data.transactionId,
        numberOfPanels: Number(data.numberOfPanels),
        sprinkler: data.sprinkler,
        walkwayAndLadder: data.walkwayAndLadder,
        requestStatus: "pending",
        status: "pending",
        isNewNotification: true,
        consumerManagement: buildConsumerManagement(itemPayload.selectedVisits),
      });
      // Create notification for admin
      // if (process.env.ADMIN_NOTIFICATION_USER_ID) {
      try {
        await createNotification({
          recipientType: "admin",

          title: "New Solar Cleaning Request",

          message: `${data.fullName} has submitted a new ${resolvedServiceName} request.`,

          type: "service",

          data: {
            requestId: application._id,
            consumerId: user._id,
            serviceName: resolvedServiceName,
            action: "view-request",
          },
        });
      } catch (notificationError) {
        console.error(
          "Failed to create admin notification:",
          notificationError
        );
      }
      // }
      createdApplications.push({
        applicationId: application._id,
        status: application.status,
        sitePhotoUrl: application.sitePhotoUrl,
        createdAt: application.createdAt,
      });


      await registerUserService(user, resolvedServiceName);
    }

    return jsonResponse(
      {
        success: true,
        message:
          createdApplications.length > 1
            ? "Applications submitted successfully."
            : "Application submitted successfully.",
        data: {
          applications: createdApplications,
          userToken: user.userProfile?.userToken || "",
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Failed to create Grow Cleaning application:",
      error
    );

    return jsonResponse(
      {
        success: false,
        message:
          "Unable to submit the application right now.",
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }
}