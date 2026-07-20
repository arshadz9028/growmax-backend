const express = require("express");
const path = require("path");
const { pathToFileURL } = require("node:url");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cors = require("cors");

const envPath = path.resolve(__dirname, ".env.local");
const defaultEnvPath = path.resolve(__dirname, ".env");

dotenv.config({ path: envPath });
dotenv.config({ path: defaultEnvPath });

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

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