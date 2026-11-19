// The shared game catalog: browse, search, view one game, add a game.
// A user's personal lists are separate: see userGameController.js (library)
// and wishlistController.js.

import validator from "validator";
import { Game } from "../models/Game.js";
import { ApiError } from "../utils/ApiError.js";
import {
  CATALOG_PLATFORM_NAMES,
  GAME_SORTS,
  PLATFORM_GROUPS,
} from "../utils/constants.js";
import { getPagination, escapeRegex } from "../utils/pagination.js";
import { requireObjectId, requireText } from "../utils/requestValidation.js";

// The MongoDB sort for each ?sort= value. Every one ends on _id, so games that
// tie keep the same order from page to page.
const SORT_ORDERS = {
  popular: { totalRatingCount: -1, totalRating: -1, _id: 1 },
  newest: { releaseDate: -1, _id: 1 },
  title: { title: 1, _id: 1 },
};

// The list leaves out each game's description, which can be thousands of
// characters. GET /api/games/:gameId returns it.
const LIST_FIELDS = "-description";

// Reads one optional text query parameter. A repeated parameter (?q=a&q=b)
// arrives as an array and is rejected rather than silently ignored.
function optionalQueryText(value, field) {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ApiError(400, "INVALID_INPUT", `${field} must be sent once`);
  }
  return value.trim() || undefined;
}

// Turns the query string of GET /api/games into a MongoDB filter and sort.
// Exported for the tests.
export function buildGameQuery(query, now = new Date()) {
  const q = optionalQueryText(query.q, "q");
  const platform = optionalQueryText(query.platform, "platform");
  const genre = optionalQueryText(query.genre, "genre");
  const sort = optionalQueryText(query.sort, "sort") ?? GAME_SORTS[0];

  if (!GAME_SORTS.includes(sort)) {
    throw new ApiError(
      400,
      "INVALID_SORT",
      `sort must be one of: ${GAME_SORTS.join(", ")}`,
    );
  }

  // An empty filter ({}) matches every game.
  const filter = {};
  if (q) {
    if (q.length > 100) {
      throw new ApiError(400, "INVALID_INPUT", "q is too long");
    }
    // Matches the text at the start of any word in the title, ignoring case:
    // "halo" finds "Halo 3" and "The Halo Collection" but not "Chalo Chalo".
    // escapeRegex makes the text match literally (see utils/pagination.js).
    filter.title = {
      $regex: `(?:^|[^\\p{L}\\p{N}])${escapeRegex(q)}`,
      $options: "iu",
    };
  }
  if (platform) {
    // One of the five groups ("PlayStation") matches all of its IGDB platforms.
    // Anything else is treated as one exact IGDB name ("PlayStation 2").
    // `platforms` is an array; both forms match games whose array contains it.
    filter.platforms = Object.hasOwn(PLATFORM_GROUPS, platform)
      ? { $in: PLATFORM_GROUPS[platform] }
      : platform;
  }
  if (genre) {
    filter.genres = genre;
  }
  if (sort === "newest") {
    // Without this, unreleased games dated years ahead would come first.
    filter.releaseDate = { $lte: now };
  }

  return { filter, sort: SORT_ORDERS[sort] };
}

// GET /api/games?q=&platform=&genre=&sort=&page=&limit=
// Responds with { games, pagination: { page, limit, total } }.
//   q        - optional, text that starts a word in the title (case-insensitive)
//   platform - optional, one of the five platforms (PlayStation, Xbox, Nintendo,
//              PC, Mobile) or one exact IGDB platform name
//   genre    - optional, one genre name from GET /api/games/genres
//   sort     - optional, popular (default), newest, or title
export async function listGames(request, response) {
  const { page, limit, skip } = getPagination(request.query);
  const { filter, sort } = buildGameQuery(request.query);

  // Counting every game reads the whole collection. With no filter, MongoDB's
  // stored collection size gives the same number straight away.
  const count =
    Object.keys(filter).length === 0
      ? Game.estimatedDocumentCount()
      : Game.countDocuments(filter);

  // Run both queries at the same time: one page of games, and the total count
  // so the client can work out how many pages there are.
  const [games, total] = await Promise.all([
    Game.find(filter).select(LIST_FIELDS).sort(sort).skip(skip).limit(limit),
    count,
  ]);
  response.json({ games, pagination: { page, limit, total } });
}

// GET /api/games/genres
// Responds with { genres } - every genre in the catalog, A to Z, for a filter.
export async function listGenres(request, response) {
  // distinct() also reports null when some game has an empty or missing genre
  // list, so keep only real names.
  const genres = (await Game.distinct("genres"))
    .filter((genre) => typeof genre === "string" && genre)
    .sort((a, b) => a.localeCompare(b));
  response.json({ genres });
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

  // Either the five short names or the IGDB names they stand for, so a game
  // added here is found by the same ?platform= filter as an imported one.
  if (
    !Array.isArray(gamePlatforms) ||
    gamePlatforms.some((platform) => !CATALOG_PLATFORM_NAMES.has(platform))
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
  // schema. Titles may repeat; IGDB is what makes an imported game unique.
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
