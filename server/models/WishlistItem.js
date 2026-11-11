// A game a user wants to play or buy. Kept separate from the library
// (UserGame) because a wishlist entry has no status, rating, or notes.

import mongoose from "mongoose";

const { Schema, model } = mongoose;

const wishlistItemSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    game: { type: Schema.Types.ObjectId, ref: "Game", required: true },
  },
  { timestamps: true },
);

// A game can be on a given user's wishlist only once.
wishlistItemSchema.index({ user: 1, game: 1 }, { unique: true });

export const WishlistItem = model("WishlistItem", wishlistItemSchema);
