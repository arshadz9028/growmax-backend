const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

const normalizedServiceAccount = {
  ...serviceAccount,
  private_key: String(serviceAccount.private_key || "").replace(/\\n/g, "\n"),
};

admin.initializeApp({
  credential: admin.cert(normalizedServiceAccount),
  projectId: normalizedServiceAccount.project_id,
});

module.exports = admin;