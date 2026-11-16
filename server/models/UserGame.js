// One entry in a user's game library: "this user has this game, with this
// status". It powers the "Completed Games" and "Next to Play" lists.
//
// This is a separate collection, rather than an array on the User document, so
// each entry can carry its own status, rating, and notes, and so a large library
// does not make every user lookup slower.

import mongoose from "mongoose";
import { LIBRARY_STATUSES } from "../utils/constants.js";

const { Schema, model } = mongoose;

const userGameSchema = new Schema(
  {
    // `ref` tells Mongoose which model an id points to, which is what lets
    // .populate("game") swap the id for the full Game document.
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    game: { type: Schema.Types.ObjectId, ref: "Game", required: true },
    status: {
      type: String,
      enum: LIBRARY_STATUSES,
      default: "next",
    },
    // Optional personal score from 1 to 10.
    rating: { type: Number, min: 1, max: 10 },
    notes: { type: String, trim: true, maxlength: 1000 },
    startedAt: Date,
    completedAt: Date,
  },
  { timestamps: true },
);

// A compound unique index: the *pair* (user, game) must be unique, so a game
// appears at most once per library. To change its status, update the entry.
userGameSchema.index({ user: 1, game: 1 }, { unique: true });

export const UserGame = model("UserGame", userGameSchema);
