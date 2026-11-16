// The shared game catalog: browse, search, view one game, add a game.
// A user's personal lists are separate: see userGameController.js (library)
// and wishlistController.js.

import validator from "validator";
import { Game } from "../models/Game.js";
import { ApiError } from "../utils/ApiError.js";
import { PLATFORMS } from "../utils/constants.js";
import { getPagination, escapeRegex } from "../utils/pagination.js";
import { requireObjectId, requireText } from "../utils/requestValidation.js";

// GET /api/games?q=&platform=&page=&limit=
// Responds with { games, pagination: { page, limit, total } }.
//   q        - optional text to search for in titles (case-insensitive)
//   platform - optional, only games available on this platform
export async function listGames(request, response) {
  const { page, limit, skip } = getPagination(request.query);

  // Build the MongoDB filter from whichever query parameters were sent.
  // An empty filter ({}) matches every game.
  const filter = {};
  if (typeof request.query.q === "string" && request.query.q.trim()) {
    // $regex with the "i" option = "title contains this text, ignoring case".
    // escapeRegex makes the text match literally (see utils/pagination.js).
    filter.title = {
      $regex: escapeRegex(request.query.q.trim()),
      $options: "i",
    };
  }
  if (typeof request.query.platform === "string") {
    // `platforms` is an array; this matches games whose array contains the value.
    filter.platforms = request.query.platform;
  }

  // Run both queries at the same time: one page of games, and the total count
  // so the client can work out how many pages there are.
  const [games, total] = await Promise.all([
    Game.find(filter).sort({ title: 1 }).skip(skip).limit(limit),
    Game.countDocuments(filter),
  ]);
  response.json({ games, pagination: { page, limit, total } });
}

// GET /api/games/:gameId
// Responds with { game }.
export async function getGame(request, response) {
  const gameId = requireObjectId(request.params.gameId, "gameId");
  const game = await Game.findById(gameId);
  if (!game) {
    throw new ApiError(404, "GAME_NOT_FOUND", "Game not found");
  }

  response.json({ game });
}

// POST /api/games  (requires a token)
// Body: { title, platforms?, genres?, description?, coverUrl?, releaseDate? }
// Responds 201 with { game }.
//
// Note: any signed-in user can add to the catalog for now. There are no admin
// roles yet; see "Known limitations" in server/README.md.
export async function createGame(request, response) {
  const title = requireText(request.body.title, "title", 120);
  // `??` means "use the right-hand side if the left is null or undefined".
  const gamePlatforms = request.body.platforms ?? [];
  const genres = request.body.genres ?? [];

  if (
    !Array.isArray(gamePlatforms) ||
    gamePlatforms.some((platform) => !PLATFORMS.includes(platform))
  ) {
    throw new ApiError(
      400,
      "INVALID_PLATFORMS",
      "Provide supported platforms as an array",
    );
  }
  if (
    !Array.isArray(genres) ||
    genres.some((genre) => typeof genre !== "string")
  ) {
    throw new ApiError(
      400,
      "INVALID_GENRES",
      "Genres must be an array of strings",
    );
  }
  // The client will put coverUrl into an <img> tag, so only accept real web
  // links. This rejects things like "javascript:..." URLs.
  if (
    request.body.coverUrl !== undefined &&
    (typeof request.body.coverUrl !== "string" ||
      !validator.isURL(request.body.coverUrl, {
        protocols: ["http", "https"],
        require_protocol: true,
      }))
  ) {
    throw new ApiError(
      400,
      "INVALID_COVER_URL",
      "coverUrl must be a valid absolute URL",
    );
  }

  // The remaining fields (description, releaseDate) are checked by the Game
  // schema. A duplicate title fails its unique index and becomes a 409 CONFLICT.
  const game = await Game.create({
    title,
    platforms: gamePlatforms,
    genres,
    description: request.body.description,
    coverUrl: request.body.coverUrl,
    releaseDate: request.body.releaseDate,
  });
  response.status(201).json({ game });
}
