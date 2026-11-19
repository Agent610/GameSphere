// A game in the shared catalog. There is one document per game for the whole
// site; users reference it from their library (UserGame), wishlist
// (WishlistItem), and posts (Post).
//
// Catalog rows imported from IGDB are identified by igdbId. Titles are not
// unique: IGDB has many games that share a name.

import mongoose from "mongoose";

const { Schema, model } = mongoose;

const gameSchema = new Schema(
  {
    // Present on games imported from IGDB. Absent on the hand-written seed.
    // Sparse so those seed documents can share the collection.
    igdbId: { type: Number, unique: true, sparse: true },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
      index: true,
    },
    // IGDB's own platform names, such as "PlayStation 2". A person's preferred
    // platform (PlayStation, Xbox, Nintendo, PC, Mobile) lives on User instead.
    platforms: [{ type: String, trim: true, maxlength: 80 }],
    genres: [{ type: String, trim: true, maxlength: 80 }],
    description: { type: String, trim: true, maxlength: 8000 },
    // Link to cover art hosted elsewhere; images are not stored in the database.
    coverUrl: { type: String, trim: true, maxlength: 2048 },
    releaseDate: Date,
    // IGDB's combined player and critic score, from 0 to 100.
    totalRating: { type: Number, min: 0, max: 100 },
    // When IGDB last changed this game. A later sync can skip unchanged rows.
    igdbUpdatedAt: Date,
    igdbUrl: { type: String, trim: true, maxlength: 2048 },
  },
  { timestamps: true },
);

export const Game = model("Game", gameSchema);
