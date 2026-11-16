// A GameSphere account.
//
// Related data lives in its own collections and points back here by user id:
// UserGame (library), WishlistItem, Follow, and Post.

import mongoose from "mongoose";
import validator from "validator";
import { PLATFORMS } from "../utils/constants.js";

const { Schema, model } = mongoose;

const UserSchema = new Schema(
  {
    // Public handle. `lowercase` stores "Alex" as "alex", so two accounts cannot
    // differ only by capitalization. The exact allowed characters are enforced by
    // USERNAME_PATTERN in the controllers. `unique` makes MongoDB reject duplicates.
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 32,
    },
    firstName: { type: String, required: true, trim: true, maxlength: 64 },
    lastName: { type: String, required: true, trim: true, maxlength: 64 },
    // Used to sign in. Private: only ever returned to the account's owner.
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: validator.isEmail,
        message: "Please provide a valid email address",
      },
    },
    // The bcrypt hash of the password, never the password itself (see
    // authController). `select: false` leaves this field out of query results
    // unless a query asks for it with .select("+passwordHash"), so it cannot be
    // sent to a client by accident.
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    // The user's main gaming platform, chosen on the register form.
    platform: {
      type: String,
      required: true,
      enum: PLATFORMS,
    },
  },
  // Adds and maintains `createdAt` and `updatedAt` automatically.
  { timestamps: true },
);

export const User = model("User", UserSchema);
