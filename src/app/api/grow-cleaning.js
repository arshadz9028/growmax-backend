import crypto from "crypto";
import { validateGrowCleaningPayload } from "../../lib/growCleaningValidation.js";
import { connectToDatabase } from "../../lib/mongodb.js";
import GrowCleaningApplication from "../../models/service.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
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
function generateUserToken(length = 10) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  let token = "";

  while (token.length < length) {
    token += chars[crypto.randomInt(chars.length)];
  }

  return token;
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

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export function GET() {
  return jsonResponse({
    success: true,
    message: "Grow Cleaning API is available.",
  });
}

export async function POST(request) {
  try {
    const payload = await request.json();

    const { data, errors, isValid } =
      validateGrowCleaningPayload(payload);

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

    await connectToDatabase();

    let sitePhotoUrl = "";

    if (data.sitePhotoBase64) {
      sitePhotoUrl = await uploadImageToCloudinary(
        data.sitePhotoBase64
      );
    }

    // Generate unique user token
    let userToken;
    let tokenExists = true;

    while (tokenExists) {
      userToken = generateUserToken(10);

      tokenExists = await GrowCleaningApplication.exists({
        userToken,
      });
    }

    const application = await GrowCleaningApplication.create({
      ...data,

        userProfile: {
          userName: data.userName || "",
          userToken: userToken,
        },

      latitude: Number(data.latitude),

      longitude: Number(data.longitude),

      numberOfPanels: Number(data.numberOfPanels) || 1,

      sprinkler: Boolean(data.sprinkler),

      walkwayAndLadder: Boolean(data.walkwayAndLadder),

      consumerNumber: data.consumerNumber || "",

      consumerNo:
        data.consumerNo || data.consumerNumber || "",

      landmark: data.landmark || "",

      sitePhotoBase64: undefined,

      sitePhotoPreview: undefined,

      sitePhotoUrl,

      status: "pending",
    });

    return jsonResponse(
      {
        success: true,
        message: "Application submitted successfully.",

        data: {
          id: application._id,

          userToken: application.userProfile.userToken,

          status: application.status,

          sitePhotoUrl: application.sitePhotoUrl,

          createdAt: application.createdAt,
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