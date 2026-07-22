const admin = require("../src/config/firebaseAdmin");

function getBearerToken(req) {
  const authHeader = req.headers.authorization || req.get("authorization");

  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(" ");

  if (!token || scheme?.toLowerCase() !== "bearer") {
    return null;
  }

  return token;
}

async function verifyToken(token) {
  return admin.auth().verifyIdToken(token);
}

async function authenticate(req, res, next) {
  try {
    if (req.method === "OPTIONS") {
      return next();
    }

    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authorization token is required.",
      });
    }

    const decodedToken = await verifyToken(token);
    req.user = decodedToken;
    req.firebaseUser = decodedToken;

    return next();
  } catch (error) {
    console.error("Firebase auth middleware failed:", error);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired Firebase token.",
      error: error.message,
    });
  }
}

async function optionalAuthenticate(req, res, next) {
  try {
    if (req.method === "OPTIONS") {
      return next();
    }

    const token = getBearerToken(req);

    if (!token) {
      req.user = null;
      req.firebaseUser = null;
      return next();
    }

    const decodedToken = await verifyToken(token);
    req.user = decodedToken;
    req.firebaseUser = decodedToken;

    return next();
  } catch (error) {
    req.user = null;
    req.firebaseUser = null;
    return next();
  }
}

module.exports = {
  authenticate,
  optionalAuthenticate,
  getBearerToken,
};
