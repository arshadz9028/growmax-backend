import mongoose from "mongoose";
import dns from "node:dns";

dns.setServers(["1.1.1.1", "8.8.8.8"]);
const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.mongo_uri ||
  process.env.MONGO_URL ||
  process.env.MONGODB_URI;
const DEFAULT_DB_NAME = process.env.MONGO_DB_NAME || "growmax";

const READY_STATE_CONNECTED = 1;
const READY_STATE_CONNECTING = 2;

function normalizeMongoUri(uri) {
  if (!uri) {
    return uri;
  }

  const trimmedUri = uri.trim();
  const hasDatabasePath = /mongodb(?:\+srv)?:\/\/[^/?]+\/[^?]+/i.test(
    trimmedUri,
  );

  if (hasDatabasePath) {
    return trimmedUri;
  }

  const queryIndex = trimmedUri.indexOf("?");
  const baseUri =
    queryIndex === -1 ? trimmedUri : trimmedUri.slice(0, queryIndex);
  const queryString = queryIndex === -1 ? "" : trimmedUri.slice(queryIndex);
  const normalizedBaseUri = baseUri.endsWith("/")
    ? `${baseUri}${DEFAULT_DB_NAME}`
    : `${baseUri}/${DEFAULT_DB_NAME}`;

  return `${normalizedBaseUri}${queryString}`;
}

const normalizedMongoUri = normalizeMongoUri(MONGO_URI);

if (!normalizedMongoUri) {
  throw new Error(
    "Missing MongoDB connection string. Set MONGO_URI, MONGO_URL, or MONGODB_URI in your env.",
  );
}

const globalCache = globalThis;

if (!globalCache.__mongooseConnection) {
  globalCache.__mongooseConnection = {
    connection: null,
    promise: null,
  };
}

const cached = globalCache.__mongooseConnection;

export async function connectToDatabase() {
  if (mongoose.connection.readyState === READY_STATE_CONNECTED) {
    cached.connection = mongoose.connection;
    return mongoose.connection;
  }

  if (
    mongoose.connection.readyState === READY_STATE_CONNECTING &&
    cached.promise
  ) {
    await cached.promise;
    cached.connection = mongoose.connection;
    return mongoose.connection;
  }

  // A previous request may have connected successfully and left a resolved
  // promise in the cache. If the underlying socket later drops, we need to
  // clear that stale promise so a fresh connection can be created.
  if (mongoose.connection.readyState !== READY_STATE_CONNECTING) {
    cached.promise = null;
    cached.connection = null;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(normalizedMongoUri, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        family: 4,
        dbName: DEFAULT_DB_NAME,
      })
      .then((mongooseInstance) => {
        cached.connection = mongooseInstance.connection;
        cached.promise = null;
        return mongooseInstance;
      })
      .catch((error) => {
        cached.promise = null;
        cached.connection = null;
        throw error;
      });
  }

  await cached.promise;
  return mongoose.connection;
}
