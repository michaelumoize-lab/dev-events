import mongoose from "mongoose";

// Extend the global NodeJS namespace to include mongoose cache
declare global {
  // eslint-disable-next-line no-var
  var mongoose: {
    conn: mongoose.Connection | null;
    promise: Promise<mongoose.Connection> | null;
  };
}

// Get MongoDB URI from environment variables
const MONGODB_URI = process.env.MONGODB_URI;

// Validate that MONGODB_URI is defined
if (!MONGODB_URI) {
  throw new Error(
    "Please define the MONGODB_URI environment variable inside .env.local"
  );
}

/**
 * Global cache to store the connection and promise
 * This prevents multiple connections during hot reloading in development
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

/**
 * Establishes and returns a cached MongoDB connection
 * @returns {Promise<mongoose.Connection>} MongoDB connection instance
 */
async function connectDB(): Promise<mongoose.Connection> {
  // Return existing connection if available
  if (cached.conn) {
    return cached.conn;
  }

  // Create new connection promise if not exists
  if (!cached.promise) {
    const options = {
      bufferCommands: false, // Disable mongoose buffering
    };

    cached.promise = mongoose
      .connect(MONGODB_URI, options)
      .then((mongooseInstance) => {
        return mongooseInstance.connection;
      });
  }

  try {
    // Await the connection promise and cache the connection
    cached.conn = await cached.promise;
  } catch (error) {
    // Reset promise on error to allow retry
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}

export default connectDB;
