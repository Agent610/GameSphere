// Values shared by several models and controllers. Keeping them in one place
// means the register form, the User model, and the Game model can never
// disagree about what a valid platform is.

// Must match the <option> values in client/src/pages/Register/Register.jsx.
export const PLATFORMS = ["PlayStation", "Xbox", "Nintendo", "PC", "Mobile"];

// The IGDB platform names that belong to each of the five platforms above.
// Imported games store IGDB's own names ("PlayStation 4", "Nintendo Switch"), so
// GET /api/games?platform=PlayStation searches for all of these at once.
// Each list also holds the group's own name, because games added through
// POST /api/games and the seed script store the five short names.
// The names were taken from the imported catalog. Platforms that fit none of the
// groups (Arcade, Amiga, Sega consoles, ...) can still be searched by exact name.
export const PLATFORM_GROUPS = {
  PlayStation: [
    "PlayStation",
    "PlayStation 2",
    "PlayStation 3",
    "PlayStation 4",
    "PlayStation 5",
    "PlayStation Portable",
    "PlayStation Vita",
    "PlayStation VR",
    "PlayStation VR2",
  ],
  Xbox: ["Xbox", "Xbox 360", "Xbox One", "Xbox Series X|S"],
  Nintendo: [
    "Nintendo",
    "Nintendo Switch",
    "Nintendo Switch 2",
    "Wii",
    "Wii U",
    "Nintendo GameCube",
    "Nintendo 64",
    "64DD",
    "Nintendo Entertainment System",
    "Family Computer",
    "Family Computer Disk System",
    "Super Nintendo Entertainment System",
    "Super Famicom",
    "Satellaview",
    "Nintendo DS",
    "Nintendo DSi",
    "Nintendo 3DS",
    "New Nintendo 3DS",
    "Game Boy",
    "Game Boy Color",
    "Game Boy Advance",
    "Virtual Boy",
    "Game & Watch",
    "Pokémon mini",
    "e-Reader / Card-e Reader",
  ],
  PC: ["PC", "PC (Microsoft Windows)", "Mac", "Linux", "DOS"],
  Mobile: [
    "Mobile",
    "Android",
    "iOS",
    "Windows Phone",
    "Windows Mobile",
    "BlackBerry OS",
    "Palm OS",
    "N-Gage",
    "Legacy Mobile Device",
  ],
};

// Every platform name POST /api/games accepts: the five groups and their IGDB names.
export const CATALOG_PLATFORM_NAMES = new Set(
  Object.values(PLATFORM_GROUPS).flat(),
);

// Orders accepted by GET /api/games?sort=. The first is the default.
//   popular - most rated on IGDB first, then highest rated
//   newest  - released games, most recent first
//   title   - A to Z
export const GAME_SORTS = ["popular", "newest", "title"];

// Where a game sits in someone's library:
//   "next"      - planning to play it
//   "playing"   - currently playing
//   "completed" - finished
export const LIBRARY_STATUSES = ["next", "playing", "completed"];

// Public profile fields. Used whenever one user's data is shown to another,
// so private fields (email, password hash) are never included by accident.
export const PUBLIC_USER_FIELDS = "username firstName lastName platform";

// RSS feeds read by GET /api/news (see services/newsService.js). These are the
// official blogs of the platforms; none needs an API key. Nintendo publishes no
// official feed. Set NEWS_FEED_URLS in .env to use a different list.
// `source` is the name shown next to each article.
export const DEFAULT_NEWS_FEEDS = [
  { source: "PlayStation Blog", url: "https://blog.playstation.com/feed/" },
  { source: "Xbox Wire", url: "https://news.xbox.com/en-us/feed/" },
  {
    source: "Steam",
    url: "https://store.steampowered.com/feeds/news/collection/steam/",
  },
];
