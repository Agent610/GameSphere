// Fetches gaming news from an outside provider and converts it into one
// consistent shape for our client.
//
// Why go through our server instead of calling the provider from React?
//   - The provider's API key stays on the server, where users cannot see it.
//   - The client depends only on OUR format, so switching provider later means
//     changing this one file.
//
// No provider has been chosen yet. It is configured with two environment
// variables (see .env.example): NEWS_API_URL and, optionally, NEWS_API_KEY.

import { ApiError } from "../utils/ApiError.js";

const PROVIDER_TIMEOUT_MS = 7000;

// Returns the value as a URL string only if it is a normal web link.
// News content comes from a third party, and the client will turn these values
// into <a href> and <img src>. Dropping anything that is not http(s) keeps out
// harmful links such as "javascript:...".
function safeUrl(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  try {
    const url = new URL(value); // throws if the text is not a valid URL
    return ["http:", "https:"].includes(url.protocol)
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

// Returns an array of { title, url, summary, imageUrl, publishedAt, source }.
// Throws an ApiError with a 5xx status if the provider is missing or misbehaves:
//   503 - not configured on our side
//   502 - the provider answered, but with an error or an unusable response
//   504 - the provider did not answer in time
export async function getGamingNews() {
  // --- 1. Check our own configuration ---------------------------------------
  if (!process.env.NEWS_API_URL) {
    throw new ApiError(
      503,
      "NEWS_PROVIDER_NOT_CONFIGURED",
      "Gaming news provider is not configured",
    );
  }

  let endpoint;
  try {
    endpoint = new URL(process.env.NEWS_API_URL);
  } catch {
    throw new ApiError(
      503,
      "NEWS_PROVIDER_NOT_CONFIGURED",
      "NEWS_API_URL must be a valid URL",
    );
  }
  // Require HTTPS so the API key is never sent unencrypted. Plain HTTP is
  // allowed only for a provider running on this machine during development.
  if (
    endpoint.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(endpoint.hostname)
  ) {
    throw new ApiError(
      503,
      "NEWS_PROVIDER_NOT_CONFIGURED",
      "NEWS_API_URL must use HTTPS",
    );
  }

  // --- 2. Call the provider -------------------------------------------------
  const headers = { accept: "application/json" };
  if (process.env.NEWS_API_KEY) {
    headers.authorization = `Bearer ${process.env.NEWS_API_KEY}`;
  }

  let response;
  try {
    response = await fetch(endpoint, {
      headers,
      // Give up if the provider is slow, rather than leaving our own client
      // waiting indefinitely.
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error.name === "TimeoutError";
    throw new ApiError(
      timedOut ? 504 : 502,
      "NEWS_PROVIDER_ERROR",
      "Gaming news provider could not be reached",
    );
  }
  if (!response.ok) {
    throw new ApiError(
      502,
      "NEWS_PROVIDER_ERROR",
      "Gaming news provider returned an error",
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(
      502,
      "NEWS_PROVIDER_ERROR",
      "Gaming news provider returned invalid JSON",
    );
  }

  // --- 3. Find the list of articles -----------------------------------------
  // Providers wrap their results differently. Accept a bare array, or an object
  // with the list under "articles" or "items".
  const items = Array.isArray(payload)
    ? payload
    : payload?.articles || payload?.items;
  if (!Array.isArray(items)) {
    throw new ApiError(
      502,
      "NEWS_PROVIDER_ERROR",
      "Gaming news provider response must contain an item list",
    );
  }

  // --- 4. Convert each article to our own shape -----------------------------
  // Providers also name fields differently (url/link, summary/description, ...),
  // so check the common alternatives. flatMap lets us skip an unusable entry by
  // returning [] and keep a good one by returning [item].
  return items.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    // An article without a title or a safe link is no use to the news panel.
    const url = safeUrl(item.url || item.link);
    if (!url || typeof item.title !== "string" || !item.title.trim()) {
      return [];
    }
    return [
      {
        title: item.title.trim(),
        url,
        summary: [item.summary, item.description].find(
          (text) => typeof text === "string",
        ),
        imageUrl: safeUrl(item.imageUrl || item.urlToImage),
        publishedAt: item.publishedAt || item.published_at,
        // Some providers send the source as a name, others as { name: "..." }.
        source:
          typeof item.source === "string" ? item.source : item.source?.name,
      },
    ];
  });
}
