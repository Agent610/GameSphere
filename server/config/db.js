// Opens the connection to MongoDB. Called once from server.js at startup.

import mongoose from "mongoose";

export default async function connectDatabase() {
  // The connection string comes from server/.env (see .env.example).
  const { MONGODB_URI: uri } = process.env;

  if (!uri) {
    throw new Error("MONGODB_URI must be set before starting the server");
  }

  // Awaiting here means server.js only starts accepting requests once the
  // database is actually reachable. If it is not, this throws and the server
  // exits with a clear message instead of failing on the first request.
  await mongoose.connect(uri);
  console.info("Connected to MongoDB");
  return mongoose.connection;
}
