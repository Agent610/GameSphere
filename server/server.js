// Entry point: `npm start` and `npm run dev` run this file.
//
// It is kept separate from app.js on purpose. app.js builds the Express app
// without starting anything, so the tests can import it and run it on a
// temporary port. This file does the parts that only apply to a real run:
// loading .env, connecting to MongoDB, and listening on a port.

// Reads server/.env into process.env. Must be first so every later import sees
// the values.
import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import connectDatabase from "./config/db.js";

const port = Number(process.env.PORT) || 3000;

async function startServer() {
  // JWT_SECRET signs login tokens. If it were missing or short, tokens could be
  // forged, so refuse to start rather than run insecurely.
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be set to at least 32 characters");
  }

  await connectDatabase();
  const server = app.listen(port, () => {
    console.info(`GameSphere API listening on port ${port}`);
  });

  // Graceful shutdown: on Ctrl+C (SIGINT) or a stop signal from a host
  // (SIGTERM), stop taking new requests, let in-flight ones finish, then close
  // the database connection.
  const shutdown = () => {
    server.close(async () => {
      await mongoose.disconnect();
      process.exitCode = 0;
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

startServer().catch((error) => {
  console.error(`Unable to start GameSphere API: ${error.message}`);
  process.exitCode = 1;
});
