// The single place where errors become HTTP responses.
//
// Express recognizes an error handler by its four arguments. It runs whenever a
// route handler throws or calls next(error), which is why controllers contain no
// try/catch blocks of their own.
//
// Every error response has the same shape so the client can handle them uniformly:
//   { "error": { "code": "GAME_NOT_FOUND", "message": "Game not found" } }

import mongoose from "mongoose";

export default function errorMiddleware(error, request, response, next) {
  // Start from what the error itself says. ApiError (utils/ApiError.js) always
  // carries a statusCode, code, and message.
  let status = error.statusCode || error.status || 500;
  let code = error.code || "INTERNAL_ERROR";
  let message = error.message || "Internal server error";

  // Errors raised by libraries rather than by our own code are translated into
  // the same vocabulary below.
  if (
    // A document failed its schema rules (required, enum, maxlength, ...).
    error instanceof mongoose.Error.ValidationError ||
    // express.json() could not parse the request body as JSON.
    error.type === "entity.parse.failed"
  ) {
    status = 400;
    code = "VALIDATION_FAILED";
    message = "Request data is invalid";
  } else if (error.type === "entity.too.large") {
    // The body exceeded the size limit set on express.json() in app.js.
    status = 413;
    code = "PAYLOAD_TOO_LARGE";
    message = "Request body is too large";
  } else if (error instanceof mongoose.Error.CastError) {
    // A value could not be converted to the type the schema expects.
    status = 400;
    code = "INVALID_ID";
    message = "The provided identifier is invalid";
  } else if (error.code === 11000) {
    // MongoDB's "duplicate key" error: a unique index rejected the write, e.g.
    // the same game added to a wishlist twice.
    status = 409;
    code = "CONFLICT";
    message = "A record with that value already exists";
  }

  // Anything left with a 5xx status and no statusCode of its own is a bug or an
  // outage. Log the details for developers, but do not send them to the client:
  // stack traces and database messages can reveal how the server works.
  if (status >= 500 && !error.statusCode) {
    console.error(error);
    code = "INTERNAL_ERROR";
    message = "Internal server error";
  }

  response.status(status).json({ error: { code, message } });
}
