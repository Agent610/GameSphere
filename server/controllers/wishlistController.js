// The signed-in user's wishlist: games they want to play or buy.
// Like the library, everything is scoped to request.user.id from the token.

import { Game } from "../models/Game.js";
import { WishlistItem } from "../models/WishlistItem.js";
import { ApiError } from "../utils/ApiError.js";
import { requireObjectId } from "../utils/requestValidation.js";

// GET /api/me/wishlist
// Responds with { items } - newest first, each with its full game details.
export async function listWishlist(request, response) {
  const items = await WishlistItem.find({ user: request.user.id })
    .populate("game")
    .sort({ createdAt: -1 });
  response.json({ items });
}

// POST /api/me/wishlist
// Body: { gameId }
// Responds 201 with { item }.
export async function addWishlistItem(request, response) {
  const gameId = requireObjectId(request.body.gameId, "gameId");
  if (!(await Game.exists({ _id: gameId }))) {
    throw new ApiError(404, "GAME_NOT_FOUND", "Game not found");
  }

  // Wishlisting the same game twice fails the unique index on WishlistItem and
  // becomes a 409 CONFLICT in errorMiddleware.
  const item = await WishlistItem.create({
    user: request.user.id,
    game: gameId,
  });
  await item.populate("game");
  response.status(201).json({ item });
}

// DELETE /api/me/wishlist/:itemId
// Responds 204. Note :itemId is the wishlist item's id, not the game's id.
export async function removeWishlistItem(request, response) {
  const itemId = requireObjectId(request.params.itemId, "itemId");
  // Matching on the user as well as the id means only the owner can remove it.
  const result = await WishlistItem.deleteOne({
    _id: itemId,
    user: request.user.id,
  });
  if (!result.deletedCount) {
    throw new ApiError(
      404,
      "WISHLIST_ITEM_NOT_FOUND",
      "Wishlist item not found",
    );
  }

  response.status(204).end();
}
