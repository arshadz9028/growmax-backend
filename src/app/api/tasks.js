import { connectToDatabase } from "../../lib/mongodb.js";
import Task from "../../models/Task.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
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

function normalizeTaskPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return {
    title: String(payload.title || "").trim(),
    priority: ["low", "medium", "high"].includes(payload.priority)
      ? payload.priority
      : "high",
    deadline: payload.deadline ? new Date(payload.deadline) : null,
    completed: Boolean(payload.completed),
    createdAt: payload.createdAt ? new Date(payload.createdAt) : new Date(),
  };
}

export async function GET(request) {
  try {
    await connectToDatabase();

    const tasks = await Task.find({}).sort({ createdAt: -1 }).lean();

    return jsonResponse(
      {
        success: true,
        data: tasks || [],
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("Failed to fetch tasks:", error);

    return jsonResponse(
      {
        success: false,
        message: "Unable to fetch tasks right now.",
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
    const normalizedPayload = normalizeTaskPayload(payload);

    if (!normalizedPayload || !normalizedPayload.title) {
      return jsonResponse(
        {
          success: false,
          message: "Task title is required.",
        },
        {
          status: 400,
        }
      );
    }

    await connectToDatabase();

    const task = await Task.create({
      ...normalizedPayload,
    });

    return jsonResponse(
      {
        success: true,
        message: "Task created successfully.",
        data: {
          task,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error("Failed to create task:", error);

    return jsonResponse(
      {
        success: false,
        message: "Unable to create task right now.",
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
    const payload = await request.json();
    const taskId = String(payload?.taskId || "").trim();

    if (!taskId) {
      return jsonResponse(
        {
          success: false,
          message: "Task identifier is required.",
        },
        {
          status: 400,
        }
      );
    }

    await connectToDatabase();

    const task = await Task.findById(taskId);

    if (!task) {
      return jsonResponse(
        {
          success: false,
          message: "Task not found.",
        },
        {
          status: 404,
        }
      );
    }

    const updates = {};

    if (payload?.title !== undefined) {
      updates.title = String(payload.title || "").trim();
    }

    if (payload?.priority !== undefined) {
      updates.priority = ["low", "medium", "high"].includes(payload.priority)
        ? payload.priority
        : task.priority;
    }

    if (payload?.deadline !== undefined) {
      updates.deadline = payload.deadline ? new Date(payload.deadline) : null;
    }

    if (payload?.completed !== undefined) {
      updates.completed = Boolean(payload.completed);
    }

    const updatedTask = await Task.findByIdAndUpdate(taskId, updates, {
      new: true,
      runValidators: true,
    });

    return jsonResponse(
      {
        success: true,
        message: "Task updated successfully.",
        data: {
          task: updatedTask,
        },
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("Failed to update task:", error);

    return jsonResponse(
      {
        success: false,
        message: "Unable to update task right now.",
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(request) {
  try {
    const { pathname, searchParams } = new URL(request.url);
    const pathSegments = pathname.split("/").filter(Boolean);
    const taskIdFromPath = pathSegments[pathSegments.length - 1];
    const taskId = String(searchParams.get("taskId") || taskIdFromPath || "").trim();

    if (!taskId || taskId === "tasks") {
      return jsonResponse(
        {
          success: false,
          message: "Task identifier is required.",
        },
        {
          status: 400,
        }
      );
    }

    await connectToDatabase();

    const task = await Task.findByIdAndDelete(taskId);

    if (!task) {
      return jsonResponse(
        {
          success: false,
          message: "Task not found.",
        },
        {
          status: 404,
        }
      );
    }

    return jsonResponse(
      {
        success: true,
        message: "Task deleted successfully.",
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("Failed to delete task:", error);

    return jsonResponse(
      {
        success: false,
        message: "Unable to delete task right now.",
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }
}
