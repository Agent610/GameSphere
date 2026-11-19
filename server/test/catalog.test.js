// Unit tests for the game catalog that need no database or network: how
// GET /api/games reads its query string, and how the IGDB sync turns an IGDB
// game into a stored document.
//
// Run with: npm test

import assert from "node:assert/strict";
import { test } from "node:test";
import { buildGameQuery } from "../controllers/gameController.js";
import { toGameDocument, toUpsert } from "../scripts/syncIgdbGames.js";
import { PLATFORM_GROUPS } from "../utils/constants.js";

// The title filter is a regular expression string for MongoDB. JavaScript
// understands the same pattern, so the tests can check what it matches.
function titleMatcher(q) {
  const { filter } = buildGameQuery({ q });
  return new RegExp(filter.title.$regex, filter.title.$options);
}

test("catalog search matches the start of a word, not the middle", () => {
  const matches = titleMatcher("halo");

  assert.ok(matches.test("Halo 3"));
  assert.ok(matches.test("The Halo Collection"));
  assert.ok(matches.test("Halo: Combat Evolved"));
  assert.ok(matches.test("HALO"));
  assert.ok(!matches.test("Chalo Chalo"));
  assert.ok(!matches.test("Shalom"));
});

test("catalog search text is matched literally", () => {
  const matches = titleMatcher("c++");

  assert.ok(matches.test("Learn C++ Today"));
  assert.ok(!matches.test("Learn Ccc Today"));
});

test("catalog search treats accented letters as part of a word", () => {
  assert.ok(!titleMatcher("mon").test("Pokémon Red"));
  assert.ok(titleMatcher("pokémon").test("Pokémon Red"));
});

test("a platform group filters on all of its IGDB platforms", () => {
  const { filter } = buildGameQuery({ platform: "PlayStation" });

  assert.deepEqual(filter.platforms, { $in: PLATFORM_GROUPS.PlayStation });
  assert.ok(filter.platforms.$in.includes("PlayStation 5"));
});

test("any other platform is matched by its exact IGDB name", () => {
  const { filter } = buildGameQuery({ platform: "PlayStation 2" });

  assert.equal(filter.platforms, "PlayStation 2");
});

test("platform names that are object properties are not groups", () => {
  const { filter } = buildGameQuery({ platform: "constructor" });

  assert.equal(filter.platforms, "constructor");
});

test("catalog sorts by popularity unless asked otherwise", () => {
  assert.deepEqual(buildGameQuery({}).sort, {
    totalRatingCount: -1,
    totalRating: -1,
    _id: 1,
  });
  assert.deepEqual(buildGameQuery({ sort: "title" }).sort, {
    title: 1,
    _id: 1,
  });
});

test("newest leaves out games that are not released yet", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const { filter, sort } = buildGameQuery({ sort: "newest" }, now);

  assert.deepEqual(filter.releaseDate, { $lte: now });
  assert.deepEqual(sort, { releaseDate: -1, _id: 1 });
});

test("catalog rejects an unknown sort and repeated parameters", () => {
  assert.throws(() => buildGameQuery({ sort: "random" }), {
    code: "INVALID_SORT",
  });
  assert.throws(() => buildGameQuery({ q: ["a", "b"] }), {
    code: "INVALID_INPUT",
  });
  assert.throws(() => buildGameQuery({ q: "x".repeat(101) }), {
    code: "INVALID_INPUT",
  });
});

test("blank query parameters are ignored", () => {
  assert.deepEqual(buildGameQuery({ q: "  ", platform: "", genre: " " }).filter, {});
});

const mobile = new Set(["android", "ios"]);

test("an IGDB game becomes a catalog document", () => {
  const document = toGameDocument(
    {
      id: 7,
      name: " Halo 3 ",
      summary: "Finish the fight.",
      first_release_date: 1190073600,
      cover: { image_id: "co1xhc" },
      genres: [{ name: "Shooter" }],
      platforms: [{ name: "Xbox 360" }],
      total_rating: 88.4,
      total_rating_count: 1532,
      updated_at: 1700000000,
      url: "https://www.igdb.com/games/halo-3",
    },
    mobile,
  );

  assert.deepEqual(document, {
    igdbId: 7,
    title: "Halo 3",
    platforms: ["Xbox 360"],
    genres: ["Shooter"],
    description: "Finish the fight.",
    coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1xhc.jpg",
    releaseDate: new Date(1190073600 * 1000),
    totalRating: 88.4,
    totalRatingCount: 1532,
    igdbUpdatedAt: new Date(1700000000 * 1000),
    igdbUrl: "https://www.igdb.com/games/halo-3",
  });
});

test("mobile-only and untitled IGDB games are skipped", () => {
  assert.equal(
    toGameDocument({ id: 1, name: "Tap", platforms: [{ name: "iOS" }] }, mobile),
    null,
  );
  assert.equal(toGameDocument({ id: 2, name: "  " }, mobile), null);
  assert.notEqual(
    toGameDocument(
      { id: 3, name: "Both", platforms: [{ name: "iOS" }, { name: "Mac" }] },
      mobile,
    ),
    null,
  );
});

test("a sync removes fields IGDB no longer has", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const { updateOne } = toUpsert(
    { igdbId: 9, title: "Bare", platforms: [], genres: [], totalRating: 50 },
    now,
  );

  assert.deepEqual(updateOne.filter, { igdbId: 9 });
  assert.equal(updateOne.upsert, true);
  assert.equal(updateOne.update.$set.totalRating, 50);
  assert.ok(!("totalRating" in updateOne.update.$unset));
  assert.deepEqual(Object.keys(updateOne.update.$unset).sort(), [
    "coverUrl",
    "description",
    "igdbUpdatedAt",
    "igdbUrl",
    "releaseDate",
    "totalRatingCount",
  ]);
});
