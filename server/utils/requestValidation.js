// Small validators for values that arrive in a request (body, params, query).
//
// Each one either returns the cleaned-up value or throws an ApiError with a
// 400 status, so controllers can validate in a single line:
//
//   const title = requireText(request.body.title, "title", 120);
//
// Checking the *type* here matters for security as well as correctness. JSON
// lets a client send an object where we expect a string, and an object such as
// { "$gt": "" } placed directly into a MongoDB query acts as a query operator
// rather than a value (a "NoSQL injection").

import mongoose from "mongoose";
import { ApiError } from "./ApiError.js";

// Usernames are stored lowercase: 3-32 characters, starting with a letter or
// digit, then letters, digits, dots, underscores, or hyphens.
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

// Confirms a value looks like a MongoDB ObjectId (the 24-character hex string
// used as `_id`). `field` is only used to name the problem in the error message.
export function requireObjectId(value, field = "id") {
  // `isValidObjectId` alone also accepts numbers and ObjectId instances, so
  // insist on a string first.
  if (typeof value !== "string" || !mongoose.isValidObjectId(value)) {
    throw new ApiError(400, "INVALID_ID", `${field} is invalid`);
  }

  return value;
}

// Confirms a value is a non-empty string no longer than `maxLength`, and
// returns it with surrounding whitespace removed.
export function requireText(value, field, maxLength) {
  if (typeof value !== "string") {
    throw new ApiError(400, "INVALID_INPUT", `${field} is required`);
  }

  const text = value.trim();
  if (!text || text.length > maxLength) {
    throw new ApiError(400, "INVALID_INPUT", `${field} is invalid`);
  }

  return text;
}
