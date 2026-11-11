// A game in the shared catalog. There is one document per game for the whole
// site; users reference it from their library (UserGame), wishlist
// (WishlistItem), and posts (Post).

import mongoose from "mongoose";
import { PLATFORMS } from "../utils/constants.js";

const { Schema, model } = mongoose;

const gameSchema = new Schema(
  {
    // `unique` stops the same game being added to the catalog twice. It also
    // creates the index that makes sorting and searching by title fast.
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      unique: true,
    },
    // Platforms the game is available on.
    platforms: [{ type: String, enum: PLATFORMS }],
    genres: [{ type: String, trim: true, maxlength: 40 }],
    description: { type: String, trim: true, maxlength: 4000 },
    // Link to cover art hosted elsewhere; images are not stored in the database.
    coverUrl: { type: String, trim: true, maxlength: 2048 },
    releaseDate: Date,
  },
  { timestamps: true },
);

export const Game = model("Game", gameSchema);
