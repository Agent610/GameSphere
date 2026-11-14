// Loads ten catalog games into MongoDB for local testing.
//
// Each game is matched on title, which is unique on the Game model, so running
// this again updates those ten documents instead of inserting duplicates.
// Games added any other way are left as they are.
//
// Run from server/: npm run seed
// Requires MONGODB_URI, normally from server/.env (see .env.example).

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDatabase from "../config/db.js";
import { Game } from "../models/Game.js";

const serverRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
dotenv.config({ path: path.join(serverRoot, ".env") });

// Platforms must be values from utils/constants.js. The Game schema rejects
// anything else. Cover images are linked, not stored, same as the model.
const games = [
  {
    title: "Among Us",
    platforms: ["PlayStation", "Xbox", "Nintendo", "PC", "Mobile"],
    genres: ["Party"],
    description:
      "A social deduction game set on a spaceship. Crewmates finish tasks while impostors try to blend in and pick them off.",
    coverUrl:
      "https://cdn.cloudflare.steamstatic.com/steam/apps/945360/header.jpg",
    releaseDate: new Date("2018-06-15"),
  },
  {
    title: "Animal Crossing: New Horizons",
    platforms: ["Nintendo"],
    genres: ["Simulation"],
    description:
      "Move to a deserted island, shape it over real-world days and seasons, and build a town with visiting animal neighbors.",
    coverUrl:
      "https://upload.wikimedia.org/wikipedia/en/1/1f/Animal_Crossing_New_Horizons.jpg",
    releaseDate: new Date("2020-03-20"),
  },
  {
    title: "Celeste",
    platforms: ["PlayStation", "Xbox", "Nintendo", "PC"],
    genres: ["Platformer"],
    description:
      "Madeline climbs Celeste Mountain in a precise platformer about persistence, with a story that sits beside the difficulty.",
    coverUrl:
      "https://cdn.cloudflare.steamstatic.com/steam/apps/504230/header.jpg",
    releaseDate: new Date("2018-01-25"),
  },
  {
    title: "Elden Ring",
    platforms: ["PlayStation", "Xbox", "PC"],
    genres: ["Action", "RPG"],
    description:
      "A vast dark-fantasy action RPG. Explore the Lands Between, fight demigods, and piece together a broken order.",
    coverUrl:
      "https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/header.jpg",
    releaseDate: new Date("2022-02-25"),
  },
  {
    title: "God of War",
    platforms: ["PlayStation", "PC"],
    genres: ["Action", "Adventure"],
    description:
      "Kratos and his son Atreus travel the realms of Norse myth. Combat stays close and heavy, and the story stays on the two of them.",
    coverUrl:
      "https://cdn.cloudflare.steamstatic.com/steam/apps/1593500/header.jpg",
    releaseDate: new Date("2018-04-20"),
  },
  {
    title: "Hades",
    platforms: ["PlayStation", "Xbox", "Nintendo", "PC"],
    genres: ["Action", "Roguelike"],
    description:
      "Zagreus fights his way out of the underworld in a fast roguelike where each failed escape changes the story.",
    coverUrl:
      "https://cdn.cloudflare.steamstatic.com/steam/apps/1145360/header.jpg",
    releaseDate: new Date("2020-09-17"),
  },
  {
    title: "Halo Infinite",
    platforms: ["Xbox", "PC"],
    genres: ["Shooter"],
    description:
      "Master Chief returns to Zeta Halo in a first-person shooter that mixes a campaign with large-scale multiplayer.",
    coverUrl:
      "https://cdn.cloudflare.steamstatic.com/steam/apps/1240440/header.jpg",
    releaseDate: new Date("2021-12-08"),
  },
  {
    title: "Stardew Valley",
    platforms: ["PlayStation", "Xbox", "Nintendo", "PC", "Mobile"],
    genres: ["Simulation", "RPG"],
    description:
      "Leave the city for a rundown farm. Grow crops, raise animals, mine, fish, and get to know the town of Pelican Town.",
    coverUrl:
      "https://cdn.cloudflare.steamstatic.com/steam/apps/413150/header.jpg",
    releaseDate: new Date("2016-02-26"),
  },
  {
    title: "The Legend of Zelda: Breath of the Wild",
    platforms: ["Nintendo"],
    genres: ["Action", "Adventure"],
    description:
      "An open-world adventure across Hyrule. Link wakes from a long sleep and sets out to defeat Calamity Ganon.",
    coverUrl:
      "https://upload.wikimedia.org/wikipedia/en/c/c6/The_Legend_of_Zelda_Breath_of_the_Wild.jpg",
    releaseDate: new Date("2017-03-03"),
  },
  {
    title: "The Witcher 3: Wild Hunt",
    platforms: ["PlayStation", "Xbox", "Nintendo", "PC"],
    genres: ["RPG"],
    description:
      "Geralt of Rivia tracks the Wild Hunt across a war-torn continent in a long, choice-heavy role-playing game.",
    coverUrl:
      "https://cdn.cloudflare.steamstatic.com/steam/apps/292030/header.jpg",
    releaseDate: new Date("2015-05-19"),
  },
];

function sameList(left, right) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

// Compare the catalog fields only. createdAt and updatedAt are left out so a
// second run can tell "already loaded" from "this game's data changed".
function sameGame(current, game) {
  return (
    sameList(current.platforms, game.platforms) &&
    sameList(current.genres, game.genres) &&
    current.description === game.description &&
    current.coverUrl === game.coverUrl &&
    current.releaseDate?.getTime() === game.releaseDate.getTime()
  );
}

async function seedGames() {
  await connectDatabase();

  const existing = await Game.find({
    title: { $in: games.map((game) => game.title) },
  });
  const byTitle = new Map(existing.map((game) => [game.title, game]));

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  for (const game of games) {
    const current = byTitle.get(game.title);
    if (!current) {
      // create() runs the Game schema validators, including the platform enum.
      await Game.create(game);
      inserted += 1;
    } else if (sameGame(current, game)) {
      unchanged += 1;
    } else {
      current.set(game);
      await current.save();
      updated += 1;
    }
  }

  console.info(
    `Seeded game catalog: ${inserted} inserted, ${updated} updated, ${unchanged} unchanged`,
  );
}

seedGames()
  .catch((error) => {
    console.error(`Unable to seed games: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
