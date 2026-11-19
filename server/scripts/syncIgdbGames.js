// Copies the IGDB catalog into the local Game collection.
//
// One IGDB game becomes one document, matched on igdbId, so running this again
// updates games that are already stored. Mobile-only games are skipped. Main
// games, remakes, remasters, and expanded editions are kept. DLC, updates, and
// mods are not requested.
//
// Run from server/: npm run sync:games
// Requires TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in server/.env.
//
// Optional:
//   IGDB_AFTER_ID=129890  resume after this IGDB id
//   IGDB_SYNC_LIMIT=20    stop after storing this many games

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDatabase from "../config/db.js";
import { Game } from "../models/Game.js";
import { createIgdbClient } from "../services/igdbClient.js";

const serverRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
dotenv.config({ path: path.join(serverRoot, ".env") });

// main_game 0, remake 8, remaster 9, expanded_game 10.
const GAME_TYPES = "(0,8,9,10)";
const PAGE_SIZE = 500;
const GAME_FIELDS = [
  "id",
  "name",
  "summary",
  "first_release_date",
  "cover.image_id",
  "genres.name",
  "platforms.name",
  "total_rating",
  "updated_at",
  "url",
].join(",");

function coverUrl(imageId) {
  if (typeof imageId !== "string" || imageId.length === 0) {
    return undefined;
  }
  return `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`;
}

function names(values, maxLength) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values
    .map((value) => (typeof value?.name === "string" ? value.name.trim() : ""))
    .filter(Boolean)
    .map((name) => name.slice(0, maxLength));
}

// Returns the document to store, or null when this game is mobile-only or has
// no title. A game with no platforms is kept: IGDB sometimes has no platform yet.
export function toGameDocument(igdbGame, mobilePlatforms) {
  const title = typeof igdbGame.name === "string" ? igdbGame.name.trim() : "";
  if (!title || typeof igdbGame.id !== "number") {
    return null;
  }

  const platforms = names(igdbGame.platforms, 80);
  if (
    platforms.length > 0 &&
    platforms.every((platform) => mobilePlatforms.has(platform.toLowerCase()))
  ) {
    return null;
  }

  const document = {
    igdbId: igdbGame.id,
    title: title.slice(0, 500),
    platforms,
    genres: names(igdbGame.genres, 80),
  };

  const description =
    typeof igdbGame.summary === "string" ? igdbGame.summary.trim() : "";
  if (description) {
    document.description = description.slice(0, 8000);
  }

  const url = coverUrl(igdbGame.cover?.image_id);
  if (url) {
    document.coverUrl = url;
  }
  if (typeof igdbGame.first_release_date === "number") {
    document.releaseDate = new Date(igdbGame.first_release_date * 1000);
  }
  if (typeof igdbGame.total_rating === "number") {
    document.totalRating = Math.min(100, Math.max(0, igdbGame.total_rating));
  }
  if (typeof igdbGame.updated_at === "number") {
    document.igdbUpdatedAt = new Date(igdbGame.updated_at * 1000);
  }
  if (typeof igdbGame.url === "string" && igdbGame.url) {
    document.igdbUrl = igdbGame.url;
  }

  return document;
}

async function mobilePlatformNames(igdb) {
  const types = await igdb.query(
    "platform_types",
    "fields name; limit 50;",
  );
  const mobileTypeIds = new Set(
    types
      .filter((type) => /mobile/i.test(type.name ?? ""))
      .map((type) => type.id),
  );

  const names = new Set();
  let afterId = 0;
  for (;;) {
    const platforms = await igdb.query(
      "platforms",
      `fields name,platform_type; where id > ${afterId}; sort id asc; limit 500;`,
    );
    if (!Array.isArray(platforms) || platforms.length === 0) {
      break;
    }

    for (const platform of platforms) {
      const name = typeof platform.name === "string" ? platform.name.trim() : "";
      if (!name) {
        continue;
      }
      const storefront =
        /^(android|ios|ipad|iphone|windows phone|blackberry os|palm os|n-gage|mobile)$/i.test(
          name,
        );
      if (storefront || mobileTypeIds.has(platform.platform_type)) {
        names.add(name.toLowerCase());
      }
    }

    afterId = platforms.at(-1).id;
    if (platforms.length < 500) {
      break;
    }
  }

  return names;
}

function optionalNumber(name) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a whole number`);
  }
  return value;
}

async function syncGames() {
  const igdb = createIgdbClient({
    clientId: process.env.TWITCH_CLIENT_ID,
    clientSecret: process.env.TWITCH_CLIENT_SECRET,
  });
  const limit = optionalNumber("IGDB_SYNC_LIMIT");
  let afterId = optionalNumber("IGDB_AFTER_ID") ?? 0;

  await connectDatabase();
  // Replaces the old unique index on title. Imported games may share a name.
  await Game.syncIndexes();

  const mobilePlatforms = await mobilePlatformNames(igdb);
  const count = await igdb.query(
    "games/count",
    `where game_type = ${GAME_TYPES};`,
  );
  console.info(
    `IGDB lists ${count.count ?? "an unknown number of"} main games, remakes, remasters, and expanded editions`,
  );

  let stored = 0;
  let skipped = 0;

  while (limit === undefined || stored < limit) {
    const page = await igdb.query(
      "games",
      [
        `fields ${GAME_FIELDS};`,
        `where id > ${afterId} & game_type = ${GAME_TYPES};`,
        "sort id asc;",
        `limit ${PAGE_SIZE};`,
      ].join(" "),
    );
    if (!Array.isArray(page) || page.length === 0) {
      break;
    }

    const documents = [];
    let lastSeenId = afterId;
    let reachedLimit = false;
    for (const igdbGame of page) {
      lastSeenId = igdbGame.id;
      const document = toGameDocument(igdbGame, mobilePlatforms);
      if (!document) {
        skipped += 1;
        continue;
      }
      documents.push(document);
      if (limit !== undefined && stored + documents.length >= limit) {
        reachedLimit = true;
        break;
      }
    }

    if (documents.length > 0) {
      const now = new Date();
      const result = await Game.bulkWrite(
        documents.map((document) => ({
          updateOne: {
            filter: { igdbId: document.igdbId },
            update: {
              $set: { ...document, updatedAt: now },
              $setOnInsert: { createdAt: now },
            },
            upsert: true,
          },
        })),
        { ordered: false },
      );
      stored += documents.length;
      console.info(
        `Stored ${stored} (page upserted ${result.upsertedCount}, modified ${result.modifiedCount}), skipped ${skipped}, through IGDB id ${lastSeenId}`,
      );
    } else {
      console.info(
        `Stored ${stored}, skipped ${skipped}, through IGDB id ${lastSeenId}`,
      );
    }

    afterId = lastSeenId;
    if (reachedLimit || page.length < PAGE_SIZE) {
      break;
    }
  }

  console.info(
    `IGDB sync finished: ${stored} stored, ${skipped} skipped, last IGDB id ${afterId}`,
  );
}

const isDirectRun =
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  syncGames()
    .catch((error) => {
      console.error(`Unable to sync IGDB games: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}
