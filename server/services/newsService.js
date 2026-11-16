// Fetches official gaming news and converts it into one consistent shape for
// our client.
//
// The news comes from RSS feeds: small XML files that blogs publish with their
// latest articles. They are free and need no API key or account. The default
// feeds are the official PlayStation, Xbox, and Steam blogs (see
// DEFAULT_NEWS_FEEDS in utils/constants.js). NEWS_FEED_URLS can replace them.
//
// Why go through our server instead of reading the feeds from React?
//   - Browsers block a page from reading another site's feed (CORS).
//   - The client depends only on OUR format, so changing the feeds later means
//     changing this one file.
//   - We can cache the result, so the blogs are not contacted on every visit.

import { XMLParser } from "fast-xml-parser";
import { ApiError } from "../utils/ApiError.js";
import { DEFAULT_NEWS_FEEDS } from "../utils/constants.js";

const FEED_TIMEOUT_MS = 7000;
// How long a fetched result is reused before the feeds are contacted again.
const CACHE_MINUTES = 10;
const MAX_ITEMS = 30;
const MAX_SUMMARY_LENGTH = 280;

const parser = new XMLParser({
  // Keep attributes such as <enclosure url="...">; they are read as "@_url".
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // Leave values as text. Otherwise a title like "2077" becomes a number.
  parseTagValue: false,
  // Feeds mark some text as HTML; decode entities such as &amp; and &#8230;.
  htmlEntities: true,
});

// The most recent result: { key, expiresAt, items }. `key` is the feed list it
// was built from, so changing NEWS_FEED_URLS never serves the old feeds' news.
let cache = null;

// Returns the value as a URL string only if it is a normal web link.
// News content comes from a third party, and the client will turn these values
// into <a href> and <img src>. Dropping anything that is not http(s) keeps out
// harmful links such as "javascript:...".
function safeUrl(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  try {
    const url = new URL(value.trim()); // throws if the text is not a valid URL
    return ["http:", "https:"].includes(url.protocol)
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

// The parser returns plain text for <title>Hi</title>, but an object for a tag
// with attributes (<guid isPermaLink="false">x</guid> -> { "#text": "x" }).
function textOf(value) {
  if (typeof value === "string") {
    return value;
  }
  return typeof value?.["#text"] === "string" ? value["#text"] : "";
}

// Feed descriptions contain HTML. The client shows the summary as plain text,
// so remove the tags, tidy the spacing, and shorten long ones.
function toSummary(html) {
  const text = html
    .replace(/<[^>]*>/g, " ")
    // WordPress feeds end with "The post <title> appeared first on <site>."
    .replace(/\s*The post .* appeared first on .*$/s, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) {
    return undefined;
  }
  return text.length > MAX_SUMMARY_LENGTH
    ? `${text.slice(0, MAX_SUMMARY_LENGTH - 1).trimEnd()}…`
    : text;
}

// Feeds attach a picture in different ways. Try the common ones in turn, then
// fall back to the first <img> inside the article's HTML.
function findImage(item) {
  const first = (value) => (Array.isArray(value) ? value[0] : value);
  const candidates = [
    first(item.enclosure)?.["@_type"]?.startsWith("image/")
      ? first(item.enclosure)["@_url"]
      : undefined,
    first(item["media:content"])?.["@_url"],
    first(item["media:thumbnail"])?.["@_url"],
    /<img[^>]+src=["']([^"']+)["']/i.exec(
      textOf(item["content:encoded"]) || textOf(item.description),
    )?.[1],
  ];

  for (const candidate of candidates) {
    const url = safeUrl(candidate);
    if (url) {
      return url;
    }
  }
  return undefined;
}

// Converts one RSS document (as text) into our article shape. Exported so the
// tests can check it without contacting a real feed.
// `sourceName` labels the articles; without it the feed's own title is used.
// Throws if the text is not an RSS feed.
export function parseFeed(xml, sourceName) {
  const channel = parser.parse(xml)?.rss?.channel;
  if (!channel) {
    throw new Error("Not an RSS feed");
  }

  const source = sourceName || textOf(channel.title).trim() || undefined;
  // A feed with a single article is parsed as one object, not an array.
  const items = [channel.item ?? []].flat();

  // flatMap lets us skip an unusable entry by returning [] and keep a good one
  // by returning [article].
  return items.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    // An article without a title or a safe link is no use to the news panel.
    const title = textOf(item.title).trim();
    const url = safeUrl(textOf(item.link));
    if (!title || !url) {
      return [];
    }

    const published = new Date(textOf(item.pubDate));
    return [
      {
        title,
        url,
        summary: toSummary(textOf(item.description)),
        imageUrl: findImage(item),
        // ISO format ("2026-11-13T17:00:13.000Z"), like every other date the
        // API returns. Left out if the feed's date cannot be read.
        publishedAt: Number.isNaN(published.getTime())
          ? undefined
          : published.toISOString(),
        source,
      },
    ];
  });
}

// Reads the list of feeds from NEWS_FEED_URLS, or uses the defaults.
// Returns an array of { url, source }, where source may be undefined.
function configuredFeeds() {
  const raw = process.env.NEWS_FEED_URLS;
  if (!raw || !raw.trim()) {
    return DEFAULT_NEWS_FEEDS;
  }

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      let url;
      try {
        url = new URL(value);
      } catch {
        throw new ApiError(
          503,
          "NEWS_PROVIDER_NOT_CONFIGURED",
          "NEWS_FEED_URLS must be a comma-separated list of URLs",
        );
      }
      // Require HTTPS so nobody between us and the blog can alter the news.
      // Plain HTTP is allowed only for a feed on this machine (the tests).
      if (
        url.protocol !== "https:" &&
        !(
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(url.hostname)
        )
      ) {
        throw new ApiError(
          503,
          "NEWS_PROVIDER_NOT_CONFIGURED",
          "NEWS_FEED_URLS must use HTTPS",
        );
      }
      return { url: url.toString() };
    });
}

async function fetchFeed(feed) {
  const response = await fetch(feed.url, {
    headers: { accept: "application/rss+xml, application/xml, text/xml" },
    // Give up on a slow feed rather than leaving our own client waiting.
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Feed responded with ${response.status}`);
  }
  return parseFeed(await response.text(), feed.source);
}

// Returns an array of { title, url, summary, imageUrl, publishedAt, source },
// newest first. Throws an ApiError with a 5xx status when no news is available:
//   503 - NEWS_FEED_URLS is set to something unusable
//   502 - every feed failed or returned something that is not a feed
//   504 - every feed failed and at least one did not answer in time
export async function getGamingNews() {
  const feeds = configuredFeeds();
  const key = feeds.map((feed) => feed.url).join(",");

  if (cache?.key === key && cache.expiresAt > Date.now()) {
    return cache.items;
  }

  // Ask all feeds at once. allSettled waits for every one and reports each as
  // "fulfilled" or "rejected", so one broken blog does not hide the others.
  const results = await Promise.allSettled(feeds.map(fetchFeed));
  const succeeded = results.filter((result) => result.status === "fulfilled");

  if (succeeded.length === 0) {
    // Old news is better than an error, so reuse the last result if we have one.
    if (cache?.key === key) {
      return cache.items;
    }
    const timedOut = results.some(
      (result) => result.reason?.name === "TimeoutError",
    );
    throw new ApiError(
      timedOut ? 504 : 502,
      "NEWS_PROVIDER_ERROR",
      "Gaming news could not be loaded",
    );
  }

  const items = succeeded
    .flatMap((result) => result.value)
    // Newest first. Articles without a date go last.
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, MAX_ITEMS);

  cache = {
    key,
    expiresAt: Date.now() + CACHE_MINUTES * 60 * 1000,
    items,
  };
  return items;
}
