// Smoke tests that need no database. They start the app on a temporary port and
// check behavior that is decided before any MongoDB query runs: routing, input
// validation, and the token check.
//
// Run with: npm test
// Tests that need MongoDB are in api.integration.test.js.

import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";
import app from "../app.js";

let server;
let baseUrl;

before(async () => {
  // Port 0 asks the operating system for any free port, so the tests never
  // clash with a dev server already running on 3000.
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("health endpoint reports API status", async () => {
  const response = await fetch(`${baseUrl}/api/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    database: false,
  });
});

test("unknown routes return a JSON 404", async () => {
  const response = await fetch(`${baseUrl}/api/missing`);

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: { code: "NOT_FOUND", message: "Route not found" },
  });
});

test("registration rejects missing required fields", async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "INVALID_INPUT");
});

test("protected profile endpoint requires a bearer token", async () => {
  const response = await fetch(`${baseUrl}/api/auth/me`);

  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, "UNAUTHENTICATED");
});

test("game routes reject malformed identifiers before database access", async () => {
  const response = await fetch(`${baseUrl}/api/games/not-an-id`);

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "INVALID_ID");
});

// Runs `fn` with NEWS_FEED_URLS set to `value`, then puts the old value back.
async function withNewsFeeds(value, fn) {
  const previous = process.env.NEWS_FEED_URLS;
  process.env.NEWS_FEED_URLS = value;

  try {
    await fn();
  } finally {
    if (previous === undefined) {
      delete process.env.NEWS_FEED_URLS;
    } else {
      process.env.NEWS_FEED_URLS = previous;
    }
  }
}

test("news endpoint rejects an unusable feed list", async () => {
  await withNewsFeeds("not a url", async () => {
    const response = await fetch(`${baseUrl}/api/news`);
    assert.equal(response.status, 503);
    assert.equal(
      (await response.json()).error.code,
      "NEWS_PROVIDER_NOT_CONFIGURED",
    );
  });
});

test("news endpoint converts RSS feeds into articles, newest first", async () => {
  // A stand-in for a real blog, so the test needs no internet connection.
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0"><channel>
      <title>Test Blog</title>
      <item>
        <title>Older &amp; wiser</title>
        <link>https://example.com/older</link>
        <pubDate>Mon, 09 Nov 2026 10:00:00 +0000</pubDate>
        <description><![CDATA[<p>Hello <b>world</b></p>]]></description>
        <enclosure url="https://example.com/cover.jpg" type="image/jpeg" />
      </item>
      <item>
        <title>Newer</title>
        <link>https://example.com/newer</link>
        <pubDate>Tue, 10 Nov 2026 10:00:00 +0000</pubDate>
      </item>
      <item>
        <title>Unsafe link is dropped</title>
        <link>javascript:alert(1)</link>
      </item>
    </channel></rss>`;
  const blog = http.createServer((request, response) => {
    if (request.url === "/feed") {
      response.setHeader("content-type", "application/rss+xml");
      response.end(rss);
    } else {
      response.statusCode = 500;
      response.end();
    }
  });
  blog.listen(0);
  await new Promise((resolve) => blog.once("listening", resolve));
  const blogUrl = `http://127.0.0.1:${blog.address().port}`;

  try {
    // The second feed is broken; the working one must still be served.
    await withNewsFeeds(`${blogUrl}/feed, ${blogUrl}/broken`, async () => {
      const response = await fetch(`${baseUrl}/api/news`);
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).items, [
        {
          title: "Newer",
          url: "https://example.com/newer",
          publishedAt: "2026-11-10T10:00:00.000Z",
          source: "Test Blog",
        },
        {
          title: "Older & wiser",
          url: "https://example.com/older",
          summary: "Hello world",
          imageUrl: "https://example.com/cover.jpg",
          publishedAt: "2026-11-09T10:00:00.000Z",
          source: "Test Blog",
        },
      ]);
    });

    await withNewsFeeds(`${blogUrl}/broken`, async () => {
      const response = await fetch(`${baseUrl}/api/news`);
      assert.equal(response.status, 502);
      assert.equal((await response.json()).error.code, "NEWS_PROVIDER_ERROR");
    });
  } finally {
    await new Promise((resolve) => blog.close(resolve));
  }
});
