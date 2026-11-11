// Smoke tests that need no database. They start the app on a temporary port and
// check behavior that is decided before any MongoDB query runs: routing, input
// validation, and the token check.
//
// Run with: npm test
// Tests that need MongoDB are in api.integration.test.js.

import assert from "node:assert/strict";
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

test("news endpoint reports missing provider configuration", async () => {
  const previousUrl = process.env.NEWS_API_URL;
  delete process.env.NEWS_API_URL;

  try {
    const response = await fetch(`${baseUrl}/api/news`);
    assert.equal(response.status, 503);
    assert.equal(
      (await response.json()).error.code,
      "NEWS_PROVIDER_NOT_CONFIGURED",
    );
  } finally {
    if (previousUrl === undefined) {
      delete process.env.NEWS_API_URL;
    } else {
      process.env.NEWS_API_URL = previousUrl;
    }
  }
});
