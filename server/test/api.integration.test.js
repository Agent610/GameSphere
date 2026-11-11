// End-to-end tests that exercise the API against a real MongoDB.
//
// Each run creates a database with a unique throwaway name and drops it at the
// end, so your development data is never touched.
//
// Run with: npm test
// By default they connect to MongoDB on this machine. To use another server:
//   MONGODB_TEST_URI=mongodb://host:27017 npm test
// If no MongoDB can be reached, these tests are skipped rather than failed.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import mongoose from "mongoose";

// authMiddleware and issueToken read this at request time. server.js normally
// checks it at startup, but the tests import app.js directly.
process.env.JWT_SECRET = "test-only-secret-that-is-at-least-32-characters";
// The tests register many accounts in a few seconds, which would otherwise trip
// the login/register rate limit (see middleware/rateLimiter.js).
process.env.AUTH_RATE_LIMIT_MAX = "1000";
const { default: app } = await import("../app.js");

const mongoUri = process.env.MONGODB_TEST_URI || "mongodb://127.0.0.1:27017";
const dbName = `gamesphere_test_${Date.now()}_${process.pid}`;

let server;
let baseUrl;
let databaseAvailable = false;

before(async () => {
  try {
    await mongoose.connect(mongoUri, {
      dbName,
      serverSelectionTimeoutMS: 2000, // fail fast when MongoDB is not running
    });
    // Wait for the unique indexes to exist; the duplicate tests depend on them.
    await Promise.all(
      Object.values(mongoose.models).map((model) => model.init()),
    );
    databaseAvailable = true;
  } catch {
    return; // every test below will skip itself
  }

  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (databaseAvailable) {
    await mongoose.connection.dropDatabase();
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.disconnect();
});

// Sends a JSON request and returns { status, body }.
async function api(method, path, { body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(baseUrl + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

// Registers a new account and returns { token, user }.
let accountCounter = 0;
async function createAccount(overrides = {}) {
  accountCounter += 1;
  const { status, body } = await api("POST", "/api/auth/register", {
    body: {
      firstName: "Test",
      lastName: "Player",
      email: `player${accountCounter}@example.com`,
      password: "correct horse battery",
      platform: "PC",
      ...overrides,
    },
  });
  assert.equal(status, 201);
  return body;
}

// Wraps test() so each test skips itself when MongoDB is unavailable.
function dbTest(name, fn) {
  test(name, async (t) => {
    if (!databaseAvailable) {
      t.skip("MongoDB is not reachable");
      return;
    }
    await fn(t);
  });
}

dbTest("register, login, and read the current account", async () => {
  const account = await createAccount({ email: "Flow@Example.com" });
  assert.equal(account.user.email, "flow@example.com"); // stored lowercase
  assert.equal(account.user.passwordHash, undefined); // never exposed

  const login = await api("POST", "/api/auth/login", {
    body: { email: "flow@example.com", password: "correct horse battery" },
  });
  assert.equal(login.status, 200);

  const me = await api("GET", "/api/auth/me", { token: login.body.token });
  assert.equal(me.status, 200);
  assert.equal(me.body.user._id, account.user._id);

  const wrong = await api("POST", "/api/auth/login", {
    body: { email: "flow@example.com", password: "not the password" },
  });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.body.error.code, "INVALID_CREDENTIALS");
});

dbTest("two people with the same name can both register", async () => {
  const first = await createAccount({ firstName: "Sam", lastName: "Twin" });
  const second = await createAccount({ firstName: "Sam", lastName: "Twin" });

  assert.equal(first.user.username, "sam.twin");
  assert.match(second.user.username, /^sam\.twin\d{4}$/);
});

dbTest("duplicate emails and chosen usernames are rejected", async () => {
  await createAccount({ email: "taken@example.com", username: "taken_name" });

  const sameEmail = await api("POST", "/api/auth/register", {
    body: {
      firstName: "A",
      lastName: "B",
      email: "taken@example.com",
      password: "long enough password",
      platform: "PC",
    },
  });
  assert.equal(sameEmail.status, 409);
  assert.equal(sameEmail.body.error.code, "ACCOUNT_EXISTS");

  const sameUsername = await api("POST", "/api/auth/register", {
    body: {
      firstName: "A",
      lastName: "B",
      email: "other@example.com",
      username: "Taken_Name",
      password: "long enough password",
      platform: "PC",
    },
  });
  assert.equal(sameUsername.status, 409);
  assert.equal(sameUsername.body.error.code, "USERNAME_TAKEN");
});

dbTest("profile updates are validated and public profiles hide email", async () => {
  const { token, user } = await createAccount();

  const bad = await api("PATCH", "/api/users/me", {
    token,
    body: { username: "has spaces" },
  });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, "INVALID_USERNAME");

  const good = await api("PATCH", "/api/users/me", {
    token,
    body: { firstName: "Renamed", platform: "Xbox" },
  });
  assert.equal(good.status, 200);
  assert.equal(good.body.user.firstName, "Renamed");

  const profile = await api("GET", `/api/users/${user._id}`);
  assert.equal(profile.status, 200);
  assert.equal(profile.body.user.platform, "Xbox");
  assert.equal(profile.body.user.email, undefined);
});

dbTest("library and wishlist entries are unique and owner-only", async () => {
  const owner = await createAccount();
  const stranger = await createAccount();

  const game = await api("POST", "/api/games", {
    token: owner.token,
    body: { title: "Library Test Game", platforms: ["PC"] },
  });
  assert.equal(game.status, 201);
  const gameId = game.body.game._id;

  const entry = await api("POST", "/api/me/games", {
    token: owner.token,
    body: { gameId, status: "playing" },
  });
  assert.equal(entry.status, 201);

  const duplicate = await api("POST", "/api/me/games", {
    token: owner.token,
    body: { gameId },
  });
  assert.equal(duplicate.status, 409);

  const entryPath = `/api/me/games/${entry.body.entry._id}`;
  const outOfRange = await api("PATCH", entryPath, {
    token: owner.token,
    body: { rating: 11 },
  });
  assert.equal(outOfRange.status, 400);

  // Someone else's token must not be able to change or delete the entry.
  const hijack = await api("PATCH", entryPath, {
    token: stranger.token,
    body: { status: "completed" },
  });
  assert.equal(hijack.status, 404);

  const completed = await api("PATCH", entryPath, {
    token: owner.token,
    body: { status: "completed", rating: 9 },
  });
  assert.equal(completed.body.entry.status, "completed");

  const wish = await api("POST", "/api/me/wishlist", {
    token: owner.token,
    body: { gameId },
  });
  assert.equal(wish.status, 201);
  const wishAgain = await api("POST", "/api/me/wishlist", {
    token: owner.token,
    body: { gameId },
  });
  assert.equal(wishAgain.status, 409);
});

dbTest("the feed shows posts from followed users only", async () => {
  const author = await createAccount();
  const follower = await createAccount();
  const stranger = await createAccount();

  const post = await api("POST", "/api/posts", {
    token: author.token,
    body: { content: "Finished the campaign!" },
  });
  assert.equal(post.status, 201);
  assert.equal(post.body.post.author.email, undefined);

  // Following twice is allowed and has no extra effect.
  const followPath = `/api/users/${author.user._id}/follow`;
  assert.equal((await api("POST", followPath, { token: follower.token })).status, 204);
  assert.equal((await api("POST", followPath, { token: follower.token })).status, 204);

  const followers = await api("GET", `/api/users/${author.user._id}/followers`);
  assert.equal(followers.body.users.length, 1);

  const followerFeed = await api("GET", "/api/posts/feed", { token: follower.token });
  assert.equal(followerFeed.body.posts.length, 1);
  assert.equal(followerFeed.body.posts[0].content, "Finished the campaign!");

  const strangerFeed = await api("GET", "/api/posts/feed", { token: stranger.token });
  assert.equal(strangerFeed.body.posts.length, 0);

  // Only the author may edit a post.
  const postPath = `/api/posts/${post.body.post._id}`;
  const hijack = await api("PATCH", postPath, {
    token: stranger.token,
    body: { content: "edited by someone else" },
  });
  assert.equal(hijack.status, 404);
});

dbTest("deleting an account removes its data and invalidates its token", async () => {
  const leaving = await createAccount();
  const staying = await createAccount();

  await api("POST", "/api/posts", {
    token: leaving.token,
    body: { content: "Goodbye" },
  });
  await api("POST", `/api/users/${leaving.user._id}/follow`, {
    token: staying.token,
  });

  const deleted = await api("DELETE", "/api/users/me", { token: leaving.token });
  assert.equal(deleted.status, 204);

  const afterDelete = await api("GET", "/api/auth/me", { token: leaving.token });
  assert.equal(afterDelete.status, 401);

  const feed = await api("GET", "/api/posts/feed", { token: staying.token });
  assert.equal(feed.body.posts.length, 0);

  const following = await api("GET", `/api/users/${staying.user._id}/following`);
  assert.equal(following.body.users.length, 0);
});
