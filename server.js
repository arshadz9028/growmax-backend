const express = require("express");
const path = require("path");
const { pathToFileURL } = require("node:url");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cors = require("cors");
const { authenticate, optionalAuthenticate } = require("./middleware/auth");

const envPath = path.resolve(__dirname, ".env.local");
const defaultEnvPath = path.resolve(__dirname, ".env");

dotenv.config({ path: envPath });
dotenv.config({ path: defaultEnvPath });

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "10mb" }));
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const upload = multer({ storage: multer.memoryStorage() });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.mongo_uri ||
  process.env.MONGO_URL ||
  process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.warn(
    "⚠️ No MongoDB connection string found in env. Set MONGO_URI, MONGO_URL, or MONGODB_URI.",
  );
}

mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    family: 4,
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log(err));

function createFetchRequest(req) {
  const requestUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    const headerValue = Array.isArray(value) ? value.join(", ") : value;
    headers.set(key, headerValue);
  }

  const init = {
    method: req.method,
    headers,
  };

  if (req.method !== "GET" && req.method !== "HEAD" && req.body != null) {
    init.body = JSON.stringify(req.body);
  }

  return new Request(requestUrl, init);
}

async function sendApiResponse(res, handler, req) {
  try {
    const response = await handler(createFetchRequest(req));
    const responseBody = await response.text();

    if (!responseBody) {
      res.status(response.status || 200).end();
      return;
    }

    try {
      const parsed = JSON.parse(responseBody);
      res.status(response.status || 200).json(parsed);
    } catch {
      res.status(response.status || 200).send(responseBody);
    }
  } catch (error) {
    console.error("API handler failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to process the request right now.",
      error: error.message,
    });
  }
}

async function loadApiModule(modulePath) {
  const fileUrl = pathToFileURL(path.resolve(__dirname, modulePath)).href;
  return import(fileUrl);
}

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Growmax Backend Running",
  });
});

app.use("/api/fetchConsumer", authenticate);
app.use("/api/fetchUser", optionalAuthenticate);
app.use("/api/fetchUserToken", optionalAuthenticate);
app.use("/api/user-profile", authenticate);
app.use("/api/grow-cleaning", optionalAuthenticate);
app.use("/api/solar-amc", optionalAuthenticate);
app.use("/api/complaints", optionalAuthenticate);
app.use("/api/tasks", optionalAuthenticate);
app.use("/api/payment", optionalAuthenticate);
// app.use("/api/payment/create-order", optionalAuthenticate);

app.options("/api/fetchConsumer", async (req, res) => {
  const { OPTIONS } = await loadApiModule("src/app/api/fetchConsumer.js");
  await sendApiResponse(res, OPTIONS, req);
});

app.get("/api/fetchConsumer", async (req, res) => {
  const { GET } = await loadApiModule("src/app/api/fetchConsumer.js");
  await sendApiResponse(res, GET, req);
});

app.options("/api/fetchUserToken", async (req, res) => {
  const { OPTIONS } = await loadApiModule("src/app/api/fetchUserToken.js");
  await sendApiResponse(res, OPTIONS, req);
});

app.get("/api/fetchUserToken", async (req, res) => {
  const { GET } = await loadApiModule("src/app/api/fetchUserToken.js");
  await sendApiResponse(res, GET, req);
});

app.options("/api/fetchUser", async (req, res) => {
  const { OPTIONS } = await loadApiModule("src/app/api/fetchUser.js");
  await sendApiResponse(res, OPTIONS, req);
});

app.get("/api/fetchUser", async (req, res) => {
  const { GET } = await loadApiModule("src/app/api/fetchUser.js");
  await sendApiResponse(res, GET, req);
});

app.options("/api/grow-cleaning", async (req, res) => {
  const { OPTIONS } = await loadApiModule("src/app/api/grow-cleaning.js");
  await sendApiResponse(res, OPTIONS, req);
});

app.get("/api/grow-cleaning", async (req, res) => {
  const { GET } = await loadApiModule("src/app/api/grow-cleaning.js");
  await sendApiResponse(res, GET, req);
});

app.post("/api/grow-cleaning", async (req, res) => {
  const { POST } = await loadApiModule("src/app/api/grow-cleaning.js");
  await sendApiResponse(res, POST, req);
});

app.options("/api/solar-amc", async (req, res) => {
  const { OPTIONS } = await loadApiModule("src/app/api/solar-amc.js");
  await sendApiResponse(res, OPTIONS, req);
});

app.get("/api/solar-amc", async (req, res) => {
  const { GET } = await loadApiModule("src/app/api/solar-amc.js");
  await sendApiResponse(res, GET, req);
});

app.post("/api/solar-amc", async (req, res) => {
  const { POST } = await loadApiModule("src/app/api/solar-amc.js");
  await sendApiResponse(res, POST, req);
});

app.options("/api/complaints", async (req, res) => {
  const { OPTIONS } = await loadApiModule("src/app/api/complaints.js");
  await sendApiResponse(res, OPTIONS, req);
});

app.get("/api/complaints", async (req, res) => {
  const { GET } = await loadApiModule("src/app/api/complaints.js");
  await sendApiResponse(res, GET, req);
});

app.post("/api/complaints", async (req, res) => {
  const { POST } = await loadApiModule("src/app/api/complaints.js");
  await sendApiResponse(res, POST, req);
});

app.options("/api/tasks", async (req, res) => {
  const { OPTIONS } = await loadApiModule("src/app/api/tasks.js");
  await sendApiResponse(res, OPTIONS, req);
});

app.get("/api/tasks", async (req, res) => {
  const { GET } = await loadApiModule("src/app/api/tasks.js");
  await sendApiResponse(res, GET, req);
});

app.post("/api/tasks", async (req, res) => {
  const { POST } = await loadApiModule("src/app/api/tasks.js");
  await sendApiResponse(res, POST, req);
});

app.patch("/api/tasks", async (req, res) => {
  const { PATCH } = await loadApiModule("src/app/api/tasks.js");
  await sendApiResponse(res, PATCH, req);
});
app.patch("/api/admin/technician-report/:technicianId", async (req, res) => {
  const { PATCH } = await loadApiModule("src/app/api/admin/technician-report.js");
  await sendApiResponse(res, PATCH, req);
});

app.delete("/api/tasks", async (req, res) => {
  const { DELETE } = await loadApiModule("src/app/api/tasks.js");
  await sendApiResponse(res, DELETE, req);
});

app.options("/api/tasks/:taskId", async (req, res) => {
  const { OPTIONS } = await loadApiModule("src/app/api/tasks.js");
  await sendApiResponse(res, OPTIONS, req);
});

app.delete("/api/tasks/:taskId", async (req, res) => {
  const { DELETE } = await loadApiModule("src/app/api/tasks.js");
  await sendApiResponse(res, DELETE, req);
});

app.options("/api/payment/test", async (req, res) => {
  const { OPTIONS } = await loadApiModule("src/app/api/payment/test.js");
  await sendApiResponse(res, OPTIONS, req);
});

app.get("/api/payment/test", async (req, res) => {
  const { GET } = await loadApiModule("src/app/api/payment/test.js");
  await sendApiResponse(res, GET, req);
});

app.options("/api/payment/create-order", async (req, res) => {
  const { OPTIONS } = await loadApiModule("src/app/api/payment/create-order.js");
  await sendApiResponse(res, OPTIONS, req);
});

app.post("/api/payment/create-order", async (req, res) => {
  const { POST } = await loadApiModule("src/app/api/payment/create-order.js");
  await sendApiResponse(res, POST, req);
});
app.post("/api/payment/verify", async (req, res) => {
  const { POST } = await loadApiModule("src/app/api/payment/verify.js");
  await sendApiResponse(res, POST, req);
});

// Direct multipart endpoint for technicians to submit visit completion with photos
app.post(
  "/api/admin/visits/:visitId/complete",
  upload.fields([
    { name: "beforePhoto", maxCount: 1 },
    { name: "afterPhoto", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { visitId } = req.params;
      console.log("Received visit completion request for visitId:", visitId);
      const status = req.body.status || "Pending";
      const requestIdBody = req.body.requestId || req.body.request_id || "";

      // Resolve visit reference: try requestId-index or fallback to requestIdBody
      let requestId = null;
      let visitIndex = null;
      const direct = String(visitId || "").match(/^([A-Fa-f0-9]{24})-(\d+)$/);
      if (direct) {
        requestId = direct[1];
        visitIndex = parseInt(direct[2], 10);
      } else if (/^visit-(\d+)$/i.test(visitId)) {
        visitIndex = parseInt(visitId.split("-")[1], 10);
      } else if (/^[A-Fa-f0-9]{24}$/.test(requestIdBody)) {
        requestId = requestIdBody;
      }

      const { default: GrowCleaningApplication } = await loadApiModule("src/models/GrowCleaningApplication.js");

      await (async () => {
        // no-op wrapper to allow await at top-level of try
      })();

      // find application/document
      let application = null;
      const mongoose = require("mongoose");
      if (requestId) {
        application = await GrowCleaningApplication.findById(requestId);
      }

      if (!application && visitIndex != null) {
        // search for application that has this visit index
        const apps = await GrowCleaningApplication.find({});
        for (const appDoc of apps) {
          const sel = appDoc.consumerManagement && appDoc.consumerManagement.selectedVisits;
          if (Array.isArray(sel) && visitIndex >= 0 && visitIndex < sel.length) {
            application = appDoc;
            requestId = String(appDoc._id);
            break;
          }
        }
      }

      if (!application) {
        return res.status(404).json({ success: false, message: "Request/application not found." });
      }

      const selected = application.consumerManagement && application.consumerManagement.selectedVisits;
      if (!Array.isArray(selected) || visitIndex == null || visitIndex < 0 || visitIndex >= selected.length) {
        return res.status(404).json({ success: false, message: "Visit not found." });
      }

      const visit = selected[visitIndex];

      // helper to upload buffer to cloudinary
      const uploadBuffer = (buffer, folder, filename) =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream({ folder }, (error, result) => {
            if (error) return reject(error);
            resolve(result.secure_url || result.url || "");
          });
          stream.end(buffer);
        });

      const beforeFile = req.files && req.files.beforePhoto && req.files.beforePhoto[0];
      const afterFile = req.files && req.files.afterPhoto && req.files.afterPhoto[0];

      // support JSON payloads with base64 data URIs
      const beforeBase64 = req.body && (req.body.beforePhotoBase64 || req.body.beforePhoto);
      const afterBase64 = req.body && (req.body.afterPhotoBase64 || req.body.afterPhoto);

      const dataUriToBuffer = (dataUri) => {
        if (!dataUri || typeof dataUri !== "string") return null;
        const match = dataUri.match(/^data:(.+);base64,(.*)$/);
        if (!match) return Buffer.from(dataUri, "base64");
        const base64 = match[2];
        return Buffer.from(base64, "base64");
      };

      let beforeBuffer = beforeFile ? beforeFile.buffer : dataUriToBuffer(beforeBase64);
      let afterBuffer = afterFile ? afterFile.buffer : dataUriToBuffer(afterBase64);

      if (!beforeBuffer || !afterBuffer) {
        return res.status(400).json({ success: false, message: "Both beforePhoto and afterPhoto are required." });
      }

      const folder = "grow_cleaning_visits";
      const beforeUrl = await uploadBuffer(beforeBuffer, folder, `before-${requestId}-${visitIndex}`);
      const afterUrl = await uploadBuffer(afterBuffer, folder, `after-${requestId}-${visitIndex}`);

      // update visit
      visit.status = status;
      visit.beforePhotoUrl = beforeUrl;
      visit.afterPhotoUrl = afterUrl;
      visit.submittedAt = new Date();

      application.markModified && application.markModified("consumerManagement.selectedVisits");
      await application.save();

      // Also store URLs into the assigned technician's assignedVisits array
      try {
          const technicianId = (visit.assignedTechnicianId && String(visit.assignedTechnicianId)) || req.body.assignedTechnicianId || req.body.technicianId || null;
          const assignedName = visit.assignedTechnicianName || req.body.assignedTechnicianName || req.body.technicianName || null;
          console.log("Assign -> resolved ids:", { technicianId, assignedName, visitAssigned: visit.assignedTechnicianId, visitAssignedName: visit.assignedTechnicianName });
        if (technicianId) {
          const { default: Technician } = await loadApiModule("src/models/Technician.js");
          if (/^[A-Fa-f0-9]{24}$/.test(String(technicianId))) {
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
                beforePhotoUrl: beforeUrl,
                afterPhotoUrl: afterUrl,
                assignedAt: visit.assignedAt || new Date(),
                // When technician submits site photos, mark the technician-side status as in-progress
                status: "In progress",
              };

              const existingIndex = (technician.assignedVisits || []).findIndex((item) =>
                String(item.requestId) === String(application._id) && Number(item.visitIndex) === Number(visitIndex)
              );

              if (!Array.isArray(technician.assignedVisits)) technician.assignedVisits = [];
              if (existingIndex >= 0) {
                technician.assignedVisits[existingIndex] = { ...(technician.assignedVisits[existingIndex].toObject?.() || technician.assignedVisits[existingIndex]), ...visitRecord };
              } else {
                technician.assignedVisits.push(visitRecord);
              }

              technician.markModified && technician.markModified("assignedVisits");
              await technician.save();
              console.log("Assigned visit saved to technician", technician._id.toString());
            }
          }
        }
      } catch (err) {
        console.error("Failed to save assigned visit to technician:", err);
      }

      return res.json({ success: true, message: "Visit submitted.", data: { requestId, visitIndex, beforeUrl, afterUrl } });
    } catch (error) {
      console.error("Failed to complete visit:", error);
      return res.status(500).json({ success: false, message: "Unable to submit visit right now.", error: error.message });
    }
  }
);

app.options("/api/admin/requests", async (req, res) => {
  const { OPTIONS } = await loadApiModule("src/app/api/admin/request.js");
  await sendApiResponse(res, OPTIONS, req);
});

app.get("/api/admin/requests", async (req, res) => {
  const { GET } = await loadApiModule("src/app/api/admin/request.js");
  await sendApiResponse(res, GET, req);
});

app.patch("/api/admin/requests/:requestId", async (req, res) => {
  const { PATCH } = await loadApiModule("src/app/api/admin/request.js");
  await sendApiResponse(res, PATCH, req);
});

app.options("/api/admin/users", async (req, res) => {
  const { OPTIONS } = await loadApiModule("src/app/api/admin/users.js");
  await sendApiResponse(res, OPTIONS, req);
});

app.get("/api/admin/users", async (req, res) => {
  const { GET } = await loadApiModule("src/app/api/admin/users.js");
  await sendApiResponse(res, GET, req);
});

app.options("/api/admin/users/:userId/services/:serviceId", async (req, res) => {
  const { OPTIONS } = await loadApiModule("src/app/api/admin/users.js");
  await sendApiResponse(res, OPTIONS, req);
});

app.patch("/api/admin/users/:userId/services/:serviceId", async (req, res) => {
  const { PATCH } = await loadApiModule("src/app/api/admin/users.js");
  await sendApiResponse(res, PATCH, req);
});

app.options("/api/admin/technicians", async (req, res) => {
  const { OPTIONS } = await loadApiModule("src/app/api/admin/technicians.js");
  await sendApiResponse(res, OPTIONS, req);
});

app.get("/api/admin/technicians", async (req, res) => {
  const { GET } = await loadApiModule("src/app/api/admin/technicians.js");
  await sendApiResponse(res, GET, req);
});

app.options("/api/admin/technicians/:technicianId/assigned-visits", async (req, res) => {
  const { OPTIONS } = await loadApiModule("src/app/api/admin/technicians.js");
  await sendApiResponse(res, OPTIONS, req);
});

app.get("/api/admin/technicians/:technicianId/assigned-visits", async (req, res) => {
  const { GET } = await loadApiModule("src/app/api/admin/technicians.js");
  await sendApiResponse(res, GET, req);
});

app.options("/api/admin/technicians/:technicianId/assigned-visits/review", async (req, res) => {
  const { OPTIONS } = await loadApiModule("src/app/api/admin/technicians.js");
  await sendApiResponse(res, OPTIONS, req);
});

app.patch("/api/admin/technicians/:technicianId/assigned-visits/review", async (req, res) => {
  const { REVIEW } = await loadApiModule("src/app/api/admin/technicians.js");
  await sendApiResponse(res, REVIEW, req);
});

app.post("/api/admin/technicians", async (req, res) => {
  const { POST } = await loadApiModule("src/app/api/admin/technicians.js");
  await sendApiResponse(res, POST, req);
});

app.options("/api/admin/technicians/login", async (req, res) => {
  const { OPTIONS } = await loadApiModule("src/app/api/admin/technicians.js");
  await sendApiResponse(res, OPTIONS, req);
});

app.post("/api/admin/technicians/login", async (req, res) => {
  const { LOGIN } = await loadApiModule("src/app/api/admin/technicians.js");
  await sendApiResponse(res, LOGIN, req);
});

app.options("/api/admin/visits", async (req, res) => {
  const { OPTIONS } = await loadApiModule("src/app/api/admin/visits.js");
  await sendApiResponse(res, OPTIONS, req);
});

app.get("/api/admin/visits", async (req, res) => {
  const { GET } = await loadApiModule("src/app/api/admin/visits.js");
  await sendApiResponse(res, GET, req);
});

app.options("/api/admin/visits/:visitId/assign", async (req, res) => {
  const { OPTIONS } = await loadApiModule("src/app/api/admin/visits.js");
  await sendApiResponse(res, OPTIONS, req);
});

app.patch("/api/admin/visits/:visitId/assign", async (req, res) => {
  const { PATCH } = await loadApiModule("src/app/api/admin/visits.js");
  await sendApiResponse(res, PATCH, req);
});

app.options("/api/admin/complaints", async (req, res) => {
  const { OPTIONS } = await loadApiModule("src/app/api/admin/complaints.js");
  await sendApiResponse(res, OPTIONS, req);
});

app.get("/api/admin/complaints", async (req, res) => {
  const { GET } = await loadApiModule("src/app/api/admin/complaints.js");
  await sendApiResponse(res, GET, req);
});

app.options("/api/admin/complaints/:complaintId", async (req, res) => {
  const { OPTIONS } = await loadApiModule("src/app/api/admin/complaints.js");
  await sendApiResponse(res, OPTIONS, req);
});

app.patch("/api/admin/complaints/:complaintId", async (req, res) => {
  const { PATCH } = await loadApiModule("src/app/api/admin/complaints.js");
  await sendApiResponse(res, PATCH, req);
});

app.options("/api/auth/google", async (req, res) => {
  const { OPTIONS } = await loadApiModule("src/app/api/auth/google/route.js");
  await sendApiResponse(res, OPTIONS, req);
});

app.post("/api/auth/google", async (req, res) => {
  const { POST } = await loadApiModule("src/app/api/auth/google/route.js");
  await sendApiResponse(res, POST, req);
});

app.options("/api/user-profile", async (req, res) => {
  const { OPTIONS } = await loadApiModule("src/app/api/user-profile.js");
  await sendApiResponse(res, OPTIONS, req);
});

app.get("/api/user-profile", async (req, res) => {
  const { GET } = await loadApiModule("src/app/api/user-profile.js");
  await sendApiResponse(res, GET, req);
});

app.post("/api/user-profile", async (req, res) => {
  const { POST } = await loadApiModule("src/app/api/user-profile.js");
  await sendApiResponse(res, POST, req);
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});