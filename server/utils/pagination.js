// Helpers for list endpoints that accept ?page= and ?limit= query parameters.

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Turns the raw query string values into safe numbers.
//
//   getPagination({ page: "3", limit: "10" })  ->  { page: 3, limit: 10, skip: 20 }
//
// Anything missing, non-numeric, or below 1 falls back to the default, and the
// limit is capped so a client cannot ask for the whole collection at once.
// `skip` is how many documents MongoDB should pass over to reach this page.
export function getPagination(query) {
  const parsedPage = Number.parseInt(query.page, 10);
  const parsedLimit = Number.parseInt(query.limit, 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, MAX_LIMIT)
      : DEFAULT_LIMIT;

  return { page, limit, skip: (page - 1) * limit };
}

// Escapes characters that have a special meaning in a regular expression, so
// user-typed search text is matched literally. Without this, a search for
// "c++" or "(" would be an invalid or unexpectedly broad pattern.
export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
