import { connectToDatabase } from "../../../lib/mongodb.js";
import User from "../../../models/user.js";

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
    await connectToDatabase();

    const users = await User.find({})
      .select("email username service")
      .sort({ createdAt: -1 })
      .lean();

    return jsonResponse(
      {
        success: true,
        data: users || [],
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("Failed to fetch users:", error);

    return jsonResponse(
      {
        success: false,
        message: "Unable to fetch users right now.",
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
    const usersIndex = parts.indexOf("users");
    const servicesIndex = parts.indexOf("services");

    const userId = usersIndex !== -1 && parts[usersIndex + 1] ? parts[usersIndex + 1] : null;
    const serviceId = servicesIndex !== -1 && parts[servicesIndex + 1] ? parts[servicesIndex + 1] : null;

    if (!userId || !serviceId) {
      return jsonResponse(
        { success: false, message: "userId and serviceId are required." },
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

    const user = await User.findById(userId);
    if (!user) {
      return jsonResponse(
        { success: false, message: "User not found." },
        { status: 404 }
      );
    }

    const service = user.service.find((item) => {
      if (!item) return false;
      if (String(item._id) === String(serviceId)) return true;
      return String(item._id) === String(Number(serviceId));
    });

    if (!service) {
      return jsonResponse(
        { success: false, message: "Service record not found." },
        { status: 404 }
      );
    }

    Object.keys(payload).forEach((key) => {
      if (payload[key] !== undefined) {
        service[key] = payload[key];
      }
    });

    await user.save();

    return jsonResponse(
      {
        success: true,
        message: "Service updated successfully.",
        data: {
          userId: user._id,
          serviceId: service._id,
          service,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to update user service:", error);

    return jsonResponse(
      {
        success: false,
        message: "Unable to update user service right now.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
