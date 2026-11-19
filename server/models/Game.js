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
    // PLATFORM_GROUPS in utils/constants.js maps one to the other.
    platforms: [{ type: String, trim: true, maxlength: 80 }],
    genres: [{ type: String, trim: true, maxlength: 80 }],
    description: { type: String, trim: true, maxlength: 8000 },
    // Link to cover art hosted elsewhere; images are not stored in the database.
    coverUrl: { type: String, trim: true, maxlength: 2048 },
    releaseDate: Date,
    // IGDB's combined player and critic score, from 0 to 100.
    totalRating: { type: Number, min: 0, max: 100 },
    // How many player and critic ratings totalRating is based on. A score from
    // one rating is not worth much, so the "popular" order sorts on this first.
    totalRatingCount: { type: Number, min: 0 },
    // When IGDB last changed this game. A later sync can skip unchanged rows.
    igdbUpdatedAt: Date,
    igdbUrl: { type: String, trim: true, maxlength: 2048 },
  },
  { timestamps: true },
);

// Indexes for GET /api/games. Each sort ends on _id so pages stay stable when
// many games tie (most games have no rating, and many share a title).
gameSchema.index({ totalRatingCount: -1, totalRating: -1, _id: 1 });
gameSchema.index({ releaseDate: -1, _id: 1 });
gameSchema.index({ platforms: 1 });
gameSchema.index({ genres: 1 });

export const Game = model("Game", gameSchema);
