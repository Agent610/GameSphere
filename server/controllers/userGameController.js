// The signed-in user's game library ("Completed Games", "Next to Play", ...).
//
// Every function here uses request.user.id, which authMiddleware set from the
// verified token. Because the user id never comes from the URL or body, one
// user cannot read or change another user's library.

import { Game } from "../models/Game.js";
import { UserGame } from "../models/UserGame.js";
import { ApiError } from "../utils/ApiError.js";
import { requireObjectId } from "../utils/requestValidation.js";

// GET /api/me/games
// Responds with { games } - library entries, most recently changed first.
export async function listUserGames(request, response) {
  const games = await UserGame.find({ user: request.user.id })
    // Each entry stores only the game's id. populate() fetches the full game so
    // the client gets the title and cover without a second request.
    .populate("game")
    .sort({ updatedAt: -1 });
  response.json({ games });
}

// POST /api/me/games
// Body: { gameId, status?, rating?, notes? }
// Responds 201 with { entry }.
export async function addUserGame(request, response) {
  const gameId = requireObjectId(request.body.gameId, "gameId");
  if (!(await Game.exists({ _id: gameId }))) {
    throw new ApiError(404, "GAME_NOT_FOUND", "Game not found");
  }

  // status, rating, and notes are validated by the UserGame schema (allowed
  // statuses, rating 1-10, notes length). Adding a game that is already in the
  // library fails the unique index and becomes a 409 CONFLICT.
  const entry = await UserGame.create({
    user: request.user.id,
    game: gameId,
    status: request.body.status,
    rating: request.body.rating,
    notes: request.body.notes,
  });
  await entry.populate("game");
  response.status(201).json({ entry });
}

// PATCH /api/me/games/:entryId
// Body: any of { status, rating, notes, startedAt, completedAt }
// Responds with the updated { entry }.
// Typical use: moving a game from "next" to "playing" to "completed".
export async function updateUserGame(request, response) {
  const entryId = requireObjectId(request.params.entryId, "entryId");

  // Copy across only the fields that may be edited (never `user` or `game`).
  const updates = {};
  for (const field of [
    "status",
    "rating",
    "notes",
    "startedAt",
    "completedAt",
  ]) {
    if (request.body[field] !== undefined) {
      updates[field] = request.body[field];
    }
  }
  if (Object.keys(updates).length === 0) {
    throw new ApiError(
      400,
      "INVALID_INPUT",
      "Provide at least one library field",
    );
  }

  // The filter requires BOTH the entry id and the signed-in user. If the entry
  // belongs to someone else nothing matches, and they get the same 404 as for an
  // entry that does not exist.
  const entry = await UserGame.findOneAndUpdate(
    { _id: entryId, user: request.user.id },
    updates,
    { returnDocument: "after", runValidators: true },
  ).populate("game");
  if (!entry) {
    throw new ApiError(
      404,
      "LIBRARY_ENTRY_NOT_FOUND",
      "Library entry not found",
    );
  }

  response.json({ entry });
}

// DELETE /api/me/games/:entryId
// Responds 204.
export async function removeUserGame(request, response) {
  const entryId = requireObjectId(request.params.entryId, "entryId");
  const result = await UserGame.deleteOne({
    _id: entryId,
    user: request.user.id,
  });
  // deletedCount is 0 when nothing matched: wrong id, or someone else's entry.
  if (!result.deletedCount) {
    throw new ApiError(
      404,
      "LIBRARY_ENTRY_NOT_FOUND",
      "Library entry not found",
    );
  }

  response.status(204).end();
}
