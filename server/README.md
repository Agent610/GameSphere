# GameSphere Backend

The GameSphere API: an [Express 5](https://expressjs.com/) server that stores its data in MongoDB through [Mongoose](https://mongoosejs.com/). The React client in `../client` talks to it over JSON.

It provides:

- **Accounts** – register, log in, view and edit your profile, delete your account
- **Game catalog** – a shared list of games to browse and search
- **Library** – each user's games, marked as next to play, playing, or completed
- **Wishlist** – games a user wants to play or buy
- **Follows** – follow other users
- **Posts and feed** – write posts and see posts from the people you follow
- **News** – gaming news fetched from an outside provider (not chosen yet)

## Contents

- [Quick start](#quick-start)
- [Configuration](#configuration)
- [How the code is organized](#how-the-code-is-organized)
- [How a request is handled](#how-a-request-is-handled)
- [How sign-in works](#how-sign-in-works)
- [API reference](#api-reference)
- [Errors](#errors)
- [Data model](#data-model)
- [Tests](#tests)
- [Connecting the React client](#connecting-the-react-client)
- [Security measures](#security-measures)
- [Known limitations](#known-limitations)

## Quick start

You need **Node.js 20.19 or newer** and a **MongoDB** database: either [installed locally](https://www.mongodb.com/docs/manual/installation/) or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster.

Run these from the `server/` folder:

```sh
npm install
cp .env.example .env
```

Open `.env` and set two values:

- `MONGODB_URI` – your MongoDB connection string. The default works for a local install.
- `JWT_SECRET` – a long random string. Generate one with:

  ```sh
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```

Then start the server:

```sh
npm run dev
```

You should see `Connected to MongoDB` and `GameSphere API listening on port 3000`. Check it is working:

```sh
curl http://localhost:3000/api/health
# {"status":"ok","database":true}
```

| Command       | What it does                                              |
| ------------- | --------------------------------------------------------- |
| `npm run dev` | Starts the server and restarts it whenever a file changes |
| `npm start`   | Starts the server once (for deployment)                   |
| `npm test`    | Runs the tests                                            |

## Configuration

Settings are read from `server/.env`. That file is ignored by Git, so each developer has their own and secrets are never committed. `.env.example` is the template.

| Variable              | Required | Default                 | Purpose                                                                 |
| --------------------- | -------- | ----------------------- | ----------------------------------------------------------------------- |
| `MONGODB_URI`         | Yes      | –                       | MongoDB connection string                                               |
| `JWT_SECRET`          | Yes      | –                       | Secret used to sign login tokens; at least 32 characters                |
| `PORT`                | No       | `3000`                  | Port the API listens on                                                 |
| `CLIENT_ORIGIN`       | No       | `http://localhost:5173` | Browser origins allowed to call the API, comma-separated                |
| `JWT_EXPIRES_IN`      | No       | `7d`                    | How long a login token lasts (for example `1h` or `7d`)                 |
| `AUTH_RATE_LIMIT_MAX` | No       | `20`                    | Login/register attempts allowed per IP address every 15 minutes         |
| `NEWS_API_URL`        | No       | –                       | News provider endpoint; `GET /api/news` returns 503 until this is set   |
| `NEWS_API_KEY`        | No       | –                       | Sent to the news provider as `Authorization: Bearer <key>` when set     |

The server refuses to start if `MONGODB_URI` is missing or `JWT_SECRET` is shorter than 32 characters.

## How the code is organized

```
server/
├── server.js        Entry point: loads .env, connects to MongoDB, starts listening
├── app.js           Builds the Express app: middleware, routes, error handling
├── config/
│   └── db.js        Opens the MongoDB connection
├── routes/          Maps each URL to a controller function
├── controllers/     The logic for each endpoint
├── models/          Mongoose schemas: the shape of the data in MongoDB
├── middleware/
│   ├── authMiddleware.js    Checks the login token on protected routes
│   ├── rateLimiter.js       Limits login/register attempts
│   └── errorMiddleware.js   Turns every error into a JSON response
├── services/
│   └── newsService.js       Fetches and tidies news from the outside provider
├── utils/           Small shared helpers (validation, pagination, constants)
└── test/            Automated tests
```

Each feature follows the same three-file pattern, so once you understand one you can read them all. For the wishlist:

| File                                   | Role                                              |
| -------------------------------------- | ------------------------------------------------- |
| `models/WishlistItem.js`               | What a wishlist item looks like in the database   |
| `controllers/wishlistController.js`    | What listing, adding, and removing actually do    |
| `routes/wishlistRoutes.js`             | Which URLs trigger those controller functions     |

Every file starts with a comment explaining its purpose, and the comments inside explain why the code does what it does.

## How a request is handled

Taking `POST /api/me/wishlist` as an example, the request passes through these steps in order:

1. **`app.js`** – shared middleware adds security headers, checks CORS, and parses the JSON body into `request.body`.
2. **`app.js`** – the path starts with `/api/me/wishlist`, so the request is handed to `routes/wishlistRoutes.js`.
3. **`middleware/authMiddleware.js`** – verifies the login token and sets `request.user.id`. Without a valid token the request stops here with a `401`.
4. **`controllers/wishlistController.js`** – `addWishlistItem` validates the input, saves a `WishlistItem`, and sends the response.
5. **`middleware/errorMiddleware.js`** – if any step throws an error, it lands here and is sent to the client as JSON.

Controllers contain no `try`/`catch`. They `throw new ApiError(status, code, message)` and Express 5 passes the error to the error middleware automatically, including errors from `async` functions.

## How sign-in works

1. The client sends an email and password to `POST /api/auth/login` (or creates an account with `POST /api/auth/register`).
2. The server responds with a **token**: a signed string (a [JWT](https://jwt.io/introduction)) containing the user's id.
3. The client stores the token and includes it in a header on later requests:

   ```
   Authorization: Bearer <token>
   ```

4. `authMiddleware` verifies the token's signature and expiry, confirms the account still exists, and makes the user's id available to the controller as `request.user.id`.

Passwords are never stored. The database holds a [bcrypt](https://en.wikipedia.org/wiki/Bcrypt) hash, which cannot be reversed into the original password.

Tokens last 7 days by default. There is no logout endpoint: to log out, the client deletes its copy of the token.

## API reference

General rules:

- Every route starts with `/api`.
- Request and response bodies are JSON. Send `Content-Type: application/json` with any request that has a body.
- Routes marked 🔒 need the `Authorization: Bearer <token>` header.
- Ids are MongoDB ObjectIds (24 hexadecimal characters) and appear as `_id` in responses.
- A `204` response means success with no body.
- Responses may include a `__v` field. It is used internally by Mongoose and can be ignored.

### Health

| Method | Path          | Description                                                      |
| ------ | ------------- | ---------------------------------------------------------------- |
| `GET`  | `/api/health` | Returns `{ status: "ok", database: true \| false }`               |

### Accounts

| Method      | Path                 | Body                                                               | Success response        |
| ----------- | -------------------- | ------------------------------------------------------------------ | ----------------------- |
| `POST`      | `/api/auth/register` | `firstName`, `lastName`, `email`, `password`, `platform`, `username`? | `201` `{ token, user }` |
| `POST`      | `/api/auth/login`    | `email`, `password`                                                | `200` `{ token, user }` |
| `GET` 🔒    | `/api/auth/me`       | –                                                                  | `200` `{ user }`        |
| `GET`       | `/api/users/:userId` | –                                                                  | `200` `{ user }`        |
| `PATCH` 🔒  | `/api/users/me`      | Any of `firstName`, `lastName`, `platform`, `username`             | `200` `{ user }`        |
| `DELETE` 🔒 | `/api/users/me`      | –                                                                  | `204`                   |

Field rules:

- `password` – 8 to 72 characters.
- `platform` – one of `PlayStation`, `Xbox`, `Nintendo`, `PC`, `Mobile`.
- `username` – optional when registering. 3–32 characters: lowercase letters, digits, `.`, `_`, `-`, starting with a letter or digit. If left out, it is built from the name (`Alex Player` becomes `alex.player`), with four digits added if that is already taken.
- `email` – case-insensitive; stored in lowercase.

Register, login, and `/api/auth/me` return the account's own details, including `email`. `GET /api/users/:userId` returns a public profile (`_id`, `username`, `firstName`, `lastName`, `platform`, `createdAt`) with no email.

Login and register are limited to 20 attempts per IP address every 15 minutes; further attempts get `429 RATE_LIMITED`.

Deleting an account also deletes the user's library, wishlist, posts, and follows in both directions.

Example:

```sh
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"firstName":"Alex","lastName":"Player","email":"alex@example.com","password":"a-long-password","platform":"PC"}'
```

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "_id": "6af489a72cff932e40648dfe",
    "username": "alex.player",
    "firstName": "Alex",
    "lastName": "Player",
    "email": "alex@example.com",
    "platform": "PC",
    "createdAt": "2026-11-11T15:28:39.228Z"
  }
}
```

### Follows

| Method      | Path                           | Success response                                  |
| ----------- | ------------------------------ | ------------------------------------------------- |
| `GET`       | `/api/users/:userId/followers` | `200` `{ users }` – people who follow this user   |
| `GET`       | `/api/users/:userId/following` | `200` `{ users }` – people this user follows      |
| `POST` 🔒   | `/api/users/:userId/follow`    | `204` – you now follow `:userId`                  |
| `DELETE` 🔒 | `/api/users/:userId/follow`    | `204` – you no longer follow `:userId`            |

Following someone you already follow, or unfollowing someone you do not follow, also succeeds with `204`. You cannot follow yourself (`400 INVALID_FOLLOW`).

### Game catalog

| Method    | Path                 | Body / query                                                                  | Success response                 |
| --------- | -------------------- | ----------------------------------------------------------------------------- | -------------------------------- |
| `GET`     | `/api/games`         | Query: `q`, `platform`, `page`, `limit`                                       | `200` `{ games, pagination }`    |
| `GET`     | `/api/games/:gameId` | –                                                                             | `200` `{ game }`                 |
| `POST` 🔒 | `/api/games`         | `title`, and optionally `platforms`, `genres`, `description`, `coverUrl`, `releaseDate` | `201` `{ game }`       |

- `q` searches game titles, ignoring case. `platform` keeps only games available on that platform.
- `platforms` and `genres` are arrays of strings. `coverUrl` must be an `http` or `https` URL. Titles must be unique.

### Library 🔒

The signed-in user's own games. All routes need a token.

| Method   | Path                     | Body                                                             | Success response  |
| -------- | ------------------------ | ---------------------------------------------------------------- | ----------------- |
| `GET`    | `/api/me/games`          | –                                                                | `200` `{ games }` |
| `POST`   | `/api/me/games`          | `gameId`, and optionally `status`, `rating`, `notes`             | `201` `{ entry }` |
| `PATCH`  | `/api/me/games/:entryId` | Any of `status`, `rating`, `notes`, `startedAt`, `completedAt`   | `200` `{ entry }` |
| `DELETE` | `/api/me/games/:entryId` | –                                                                | `204`             |

- `status` is `next` (the default), `playing`, or `completed`. `rating` is a number from 1 to 10.
- `:entryId` is the `_id` of the library entry, not of the game.
- Each entry includes the full game under `game`.
- A game can be in a library once; adding it again returns `409 CONFLICT`. Change its status with `PATCH` instead.

```sh
curl -X POST http://localhost:3000/api/me/games \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{"gameId":"<game id>","status":"playing"}'
```

### Wishlist 🔒

| Method   | Path                       | Body     | Success response  |
| -------- | -------------------------- | -------- | ----------------- |
| `GET`    | `/api/me/wishlist`         | –        | `200` `{ items }` |
| `POST`   | `/api/me/wishlist`         | `gameId` | `201` `{ item }`  |
| `DELETE` | `/api/me/wishlist/:itemId` | –        | `204`             |

`:itemId` is the `_id` of the wishlist item, not of the game. Adding the same game twice returns `409 CONFLICT`.

### Posts and feed

| Method      | Path                      | Body / query                      | Success response              |
| ----------- | ------------------------- | --------------------------------- | ----------------------------- |
| `GET` 🔒    | `/api/posts/feed`         | Query: `page`, `limit`            | `200` `{ posts, pagination }` |
| `GET`       | `/api/posts/user/:userId` | Query: `page`, `limit`            | `200` `{ posts, pagination }` |
| `POST` 🔒   | `/api/posts`              | `content`, and optionally `gameId` | `201` `{ post }`             |
| `PATCH` 🔒  | `/api/posts/:postId`      | Any of `content`, `gameId`        | `200` `{ post }`              |
| `DELETE` 🔒 | `/api/posts/:postId`      | –                                 | `204`                         |

- The feed contains your own posts and posts by people you follow, newest first.
- `content` is 1 to 2000 characters. `gameId` links the post to a catalog game; send `"gameId": null` in a `PATCH` to remove the link.
- Only a post's author can edit or delete it. Anyone else gets `404 POST_NOT_FOUND`.
- Each post includes its `author` (public profile fields) and, when linked, its `game` (`title` and `coverUrl`).

### News

| Method | Path        | Success response  |
| ------ | ----------- | ----------------- |
| `GET`  | `/api/news` | `200` `{ items }` |

Each item has `title` and `url`, plus `summary`, `imageUrl`, `publishedAt`, and `source` when the provider supplies them.

No news provider has been chosen yet, so this returns `503 NEWS_PROVIDER_NOT_CONFIGURED` until `NEWS_API_URL` is set. The provider must respond with JSON that is either an array of articles or an object with the array under `articles` or `items`. Each article needs a `title` and a `url` (or `link`).

### Pagination

`GET /api/games`, `GET /api/posts/feed`, and `GET /api/posts/user/:userId` return results one page at a time.

| Query parameter | Default | Notes          |
| --------------- | ------- | -------------- |
| `page`          | `1`     | Starts at 1    |
| `limit`         | `20`    | Maximum `100`  |

The response includes `"pagination": { "page": 1, "limit": 20, "total": 57 }`, where `total` is the number of matching records across all pages.

## Errors

Every error has the same shape:

```json
{ "error": { "code": "GAME_NOT_FOUND", "message": "Game not found" } }
```

Use `code` in client logic, because it will not change. `message` is a readable sentence that can be shown to the user.

| Status | Code                                                                    | Meaning                                                          |
| ------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `400`  | `INVALID_INPUT`                                                         | A required field is missing, empty, too long, or the wrong type  |
| `400`  | `VALIDATION_FAILED`                                                     | The body is not valid JSON, or a value breaks a data rule        |
| `400`  | `INVALID_ID`                                                            | An id is not a valid ObjectId                                    |
| `400`  | `INVALID_EMAIL`, `WEAK_PASSWORD`, `INVALID_USERNAME`, `INVALID_PLATFORM` | A registration or profile field breaks its rule                  |
| `400`  | `INVALID_PLATFORMS`, `INVALID_GENRES`, `INVALID_COVER_URL`              | A catalog game field breaks its rule                             |
| `400`  | `INVALID_FOLLOW`                                                        | You tried to follow yourself                                     |
| `401`  | `UNAUTHENTICATED`                                                       | The token is missing, invalid, expired, or its account is gone   |
| `401`  | `INVALID_CREDENTIALS`                                                   | Wrong email or password                                          |
| `404`  | `NOT_FOUND`                                                             | No such route                                                    |
| `404`  | `USER_NOT_FOUND`, `GAME_NOT_FOUND`, `POST_NOT_FOUND`, `LIBRARY_ENTRY_NOT_FOUND`, `WISHLIST_ITEM_NOT_FOUND` | The record does not exist, or is not yours to change |
| `409`  | `ACCOUNT_EXISTS`, `USERNAME_TAKEN`                                      | The email or username is already registered                      |
| `409`  | `CONFLICT`                                                              | The record already exists (duplicate game title, library entry, or wishlist item) |
| `413`  | `PAYLOAD_TOO_LARGE`                                                     | The request body is over 1 MB                                    |
| `429`  | `RATE_LIMITED`                                                          | Too many login or register attempts                              |
| `500`  | `INTERNAL_ERROR`                                                        | A bug or outage on the server; details are in the server log     |
| `502`, `504` | `NEWS_PROVIDER_ERROR`                                             | The news provider failed or timed out                            |
| `503`  | `NEWS_PROVIDER_NOT_CONFIGURED`                                          | `NEWS_API_URL` is not set or not valid                           |

## Data model

Six collections. Users and games are the core; the other four link them together.

```
User ──< UserGame >── Game        a user's library entry for a game
User ──< WishlistItem >── Game    a game on a user's wishlist
User ──< Follow >── User          one user following another
User ──< Post ──(optional)── Game a post, optionally about a game
```

| Model          | Fields                                                                                  | Rules                                          |
| -------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `User`         | `username`, `firstName`, `lastName`, `email`, `passwordHash`, `platform`                | `username` and `email` are unique              |
| `Game`         | `title`, `platforms[]`, `genres[]`, `description`, `coverUrl`, `releaseDate`            | `title` is unique                              |
| `UserGame`     | `user`, `game`, `status`, `rating`, `notes`, `startedAt`, `completedAt`                 | One per user and game                          |
| `WishlistItem` | `user`, `game`                                                                          | One per user and game                          |
| `Follow`       | `follower`, `following`                                                                 | One per pair of users                          |
| `Post`         | `author`, `content`, `game`                                                             | –                                              |

Every document also has `_id`, `createdAt`, and `updatedAt`, which MongoDB and Mongoose maintain automatically.

## Tests

```sh
npm test
```

The tests use Node's built-in test runner, so there is nothing extra to install.

| File                            | Covers                                                                      | Needs MongoDB |
| ------------------------------- | --------------------------------------------------------------------------- | ------------- |
| `test/app.test.js`              | Routing, input validation, and the token check                              | No            |
| `test/api.integration.test.js`  | Full flows: sign-up, login, profiles, library, wishlist, follows, feed, account deletion | Yes |

The integration tests create a temporary database with a unique name and delete it when they finish, so they never touch your development data. They connect to MongoDB on your machine by default; set `MONGODB_TEST_URI` to use a different server. If MongoDB cannot be reached, they are skipped and the remaining tests still run.

## Connecting the React client

The client does not call the API yet. When wiring it up:

- **Base URL** – the API runs at `http://localhost:3000` in development. CORS already allows the Vite dev server at `http://localhost:5173`.
- **Register** – the field names in `client/src/pages/Register/Register.jsx` already match what `POST /api/auth/register` expects.
- **Login** – `POST /api/auth/login` expects `email`, but the email input in `client/src/pages/Login/Login.jsx` is currently named `name`. Rename it, or map it when building the request.
- **After login** – keep the returned `token` and send it as `Authorization: Bearer <token>` on protected requests. Use `GET /api/auth/me` to restore the signed-in user after a page refresh.

## Security measures

- Passwords are stored only as bcrypt hashes and are never included in any response.
- Login tokens are signed, expire, and stop working as soon as the account is deleted.
- Users can only change their own data. The user id always comes from the verified token, never from the request.
- Login and registration are rate limited per IP address.
- Request input is type-checked before it reaches a database query, which blocks NoSQL operator injection.
- Only origins listed in `CLIENT_ORIGIN` can call the API from a browser.
- [helmet](https://helmetjs.github.io/) sets standard security headers.
- Unexpected server errors are logged on the server and reported to the client only as `INTERNAL_ERROR`.

## Known limitations

- **Anyone signed in can add catalog games.** There are no admin roles or moderation yet.
- **No password reset, email verification, or password change.**
- **No logout endpoint.** A token stays valid until it expires or the account is deleted.
- **Library, wishlist, and follower lists are not paginated.** They return everything.
- **News is not cached.** Each `GET /api/news` calls the provider, which may matter for providers with request quotas.
- **Likes, comments, and gaming-channel accounts** from the project vision are not built yet.
- **Rate limiting behind a proxy.** Attempts are counted per IP address. On a host that puts a proxy in front of the app (most do), Express's [`trust proxy`](https://expressjs.com/en/guide/behind-proxies.html) setting must be configured, or all users will share one limit.
- **Development dependency advisory.** `npm audit` reports two moderate issues in `nodemon`, which is used only by `npm run dev`. The packages the running server depends on have none.
