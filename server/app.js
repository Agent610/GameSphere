// Builds and exports the Express app: middleware first, then routes, then the
// 404 and error handlers. Order matters, because Express runs these top to
// bottom for every request.
//
// Nothing here starts a server or touches the database. See server.js for that.

import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import authRoutes from "./routes/authRoutes.js";
import gameRoutes from "./routes/gameRoutes.js";
import newsRoutes from "./routes/newsRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import userGameRoutes from "./routes/userGameRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import errorMiddleware from "./middleware/errorMiddleware.js";

const app = express();

// --- Security headers -------------------------------------------------------
// helmet sets a group of HTTP response headers that switch on browser
// protections (for example, forbidding the API from being embedded in a frame).
app.use(helmet());

// --- CORS -------------------------------------------------------------------
// Browsers block a page on one origin (the Vite client, http://localhost:5173)
// from calling an API on another (this server, http://localhost:3000) unless
// the API opts in. CLIENT_ORIGIN lists who may call us, comma-separated, so the
// local client and a deployed one can both be allowed.
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Requests with no Origin header are not from a browser page (curl,
      // Postman, the tests), so CORS does not apply to them.
      callback(null, !origin || allowedOrigins.includes(origin));
    },
  }),
);

// --- Body parsing -----------------------------------------------------------
// Parses JSON request bodies into `request.body`. The size limit stops a client
// from sending an enormous body to tie up the server.
app.use(express.json({ limit: "1mb" }));

// Guarantees `request.body` is always a plain object, so controllers can read
// `request.body.someField` without first checking that a body exists.
//   - No body at all (GET, DELETE, ...)  -> use {}
//   - Valid JSON that is not an object ([1, 2], "text", null) -> reject with 400
app.use((request, response, next) => {
  if (request.body === undefined) {
    request.body = {};
  } else if (
    !request.body ||
    typeof request.body !== "object" ||
    Array.isArray(request.body)
  ) {
    return next({
      statusCode: 400,
      code: "INVALID_INPUT",
      message: "Request body must be a JSON object",
    });
  }
  return next();
});

// --- Routes -----------------------------------------------------------------
// A quick way to check the server is up and whether MongoDB is connected
// (readyState 1 means "connected").
app.get("/api/health", (request, response) => {
  response.json({
    status: "ok",
    database: mongoose.connection.readyState === 1,
  });
});

// Each router lives in routes/ and maps URLs to functions in controllers/.
// Routes under /api/me/... always act on the signed-in user's own data.
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/games", gameRoutes);
app.use("/api/me/games", userGameRoutes);
app.use("/api/me/wishlist", wishlistRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/news", newsRoutes);

// --- Fallbacks --------------------------------------------------------------
// Reached only if no route above matched.
app.use((request, response) => {
  response.status(404).json({
    error: { code: "NOT_FOUND", message: "Route not found" },
  });
});

// Must be registered last: receives every error thrown by the code above.
app.use(errorMiddleware);

export default app;
