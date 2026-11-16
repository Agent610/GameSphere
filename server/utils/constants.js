// Values shared by several models and controllers. Keeping them in one place
// means the register form, the User model, and the Game model can never
// disagree about what a valid platform is.

// Must match the <option> values in client/src/pages/Register/Register.jsx.
export const PLATFORMS = ["PlayStation", "Xbox", "Nintendo", "PC", "Mobile"];

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
