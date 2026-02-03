import mongoose from "mongoose";

// Declare HMR‑persisted globals (dev only). In prod these are unused.
declare global {
  // eslint-disable-next-line no-var
  var _mongoConn: mongoose.Connection | null | undefined;
  // eslint-disable-next-line no-var
  var _mongoPromise: Promise<mongoose.Connection> | null | undefined;
}

// Get MongoDB URI from environment variables
const MONGODB_URI = process.env.MONGODB_URI;

// Validate that MONGODB_URI is defined
if (!MONGODB_URI) {
  throw new Error(
    "Please define the MONGODB_URI environment variable inside .env.local"
  );
}

// Narrow type for use below (after runtime guard above)
const MONGODB_URI_STR: string = MONGODB_URI as string;

// Module-level fallbacks (used in production to keep behavior unchanged)
let moduleConn: mongoose.Connection | null = null;
let modulePromise: Promise<mongoose.Connection> | null = null;

/**
 * Establishes and returns a cached MongoDB connection
 * @returns {Promise<mongoose.Connection>} MongoDB connection instance
 */
async function connectDB(): Promise<mongoose.Connection> {
  const useGlobal = process.env.NODE_ENV !== "production";

  // Initialize globals in dev so they survive HMR reloads
  if (useGlobal) {
    if (globalThis._mongoConn === undefined) globalThis._mongoConn = null;
    if (globalThis._mongoPromise === undefined) globalThis._mongoPromise = null;
  }

  const getConn = () => (useGlobal ? globalThis._mongoConn! : moduleConn);
  const setConn = (c: mongoose.Connection | null) => {
    if (useGlobal) globalThis._mongoConn = c;
    else moduleConn = c;
  };
  const getPromise = () => (useGlobal ? globalThis._mongoPromise! : modulePromise);
  const setPromise = (p: Promise<mongoose.Connection> | null) => {
    if (useGlobal) globalThis._mongoPromise = p;
    else modulePromise = p;
  };

  // Return existing connection if available
  const existingConn = getConn();
  if (existingConn) {
    return existingConn;
  }

  // Create new connection promise if not exists
  if (!getPromise()) {
    const options = {
      bufferCommands: false, // Disable mongoose buffering
    } as const;

    const promise = mongoose.connect(MONGODB_URI_STR, options).then((mongooseInstance) => {
      return mongooseInstance.connection;
    });
    // Persist the promise to survive HMR
    setPromise(promise);
  }

  try {
    const conn = await getPromise()!;
    setConn(conn);
    return conn;
  } catch (error) {
    // Clear persisted promise on failure so subsequent retries work
    setPromise(null);
    throw error;
  }
}

export default connectDB;
