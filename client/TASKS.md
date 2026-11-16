# Frontend tasks

A to-do list for the React client, written by the backend pair on 2026-11-16. The API is finished, so everything below can be built against the real server today. Tick a box when a task is merged.

The tasks are in a suggested order: each one builds on the ones above it. Tasks 1 to 4 are the foundation and are best done first, by one person or together. After that, tasks 5 to 9 are independent of each other and can be split between you.

Every route, field name, and error code is documented in [server/README.md](../server/README.md). If the API does not do something a screen needs, tell the backend pair and we will change the API to fit.

## Before you start: run the API on your machine

You need MongoDB installed locally (or a free MongoDB Atlas cluster).

```sh
cd server
npm install
cp .env.example .env    # then set JWT_SECRET (the file explains how)
npm run seed            # adds ten sample games to the catalog
npm run dev             # http://localhost:3000
```

Check it works by opening <http://localhost:3000/api/games> in a browser. You should see the ten games as JSON.

## Foundation

### 1. Fix the Login stylesheet import

- [ ] The first line of `src/pages/Login/Login.jsx` is `"import ./Login.css";`. The quotes are in the wrong place, so it is a plain string and the stylesheet never loads. Change it to `import "./Login.css";`.

### 2. Add an API helper

- [ ] Create `src/utils/api.js` with one function that every component uses to call the server, so the base URL and token handling live in one place.
- [ ] Read the base URL from `import.meta.env.VITE_API_URL`, falling back to `http://localhost:3000`. This lets the deployed site point at the deployed API later.
- [ ] Send `Content-Type: application/json` when there is a body, and `Authorization: Bearer <token>` when the user is signed in.
- [ ] When the response is not OK, throw an error carrying the API's `error.code` and `error.message`. Every API error has the shape `{ "error": { "code": "...", "message": "..." } }`. A `204` response has no body, so do not try to parse one.

### 3. Connect Register and Login to the API

`handleRegister` and `handleLogin` in `src/components/App/App.jsx` currently only show a "validated" message.

- [ ] **Register:** send the form's values to `POST /api/auth/register`. The input names already match what the API expects (`firstName`, `lastName`, `platform`, `email`, `password`), so `Object.fromEntries(new FormData(event.target))` gives you the request body.
- [ ] **Login:** send the form's values to `POST /api/auth/login`. The email input is named `name`, and the API accepts that as it is, so no renaming is needed.
- [ ] Both respond with `{ token, user }`. Keep both in state and save the token in `localStorage`.
- [ ] Show the API's `error.message` when a request fails. The ones you will meet most: `INVALID_CREDENTIALS` (wrong email or password), `ACCOUNT_EXISTS` (email already registered), `WEAK_PASSWORD`, and `RATE_LIMITED` (too many attempts).

### 4. Stay signed in, sign out, and move between pages

- [ ] When the app loads with a saved token, call `GET /api/auth/me` to get the user back. If it answers `401`, the token has expired: remove it and show Login.
- [ ] Add sign out: remove the token and user, and return to Login. There is no logout route to call.
- [ ] Add [React Router](https://reactrouter.com/) (`npm install react-router-dom`) to replace the `currentPage` state. Suggested routes: `/login`, `/register`, `/` (feed), `/games`, `/profile`, `/users/:userId`.
- [ ] Send signed-out visitors to `/login` when they open a page that needs an account.

## Screens

### 5. Header and Footer

Files: `src/components/Header/`, `src/components/Footer/` (both empty).

- [ ] Header: the GameSphere name, links to Feed, Games, and Profile, the signed-in user's name, and a sign-out button.
- [ ] Footer: the project name and the four contributors.
- [ ] Show both on every page except Login and Register.

### 6. Game catalog: GameList and GameCard

Files: `src/components/GameList/`, `src/components/GameCard/` (both empty).

- [ ] GameCard shows one game: cover image (`coverUrl`), `title`, `platforms`, and `genres`. Some games have no cover, so give the card a placeholder.
- [ ] GameList loads `GET /api/games` and renders a GameCard for each game in `games`.
- [ ] Add a search box (`?q=zelda`) and a platform filter (`?platform=PC`). The platform values are the same five as on the Register form.
- [ ] Add paging with `?page=2&limit=20`. The response includes `pagination: { page, limit, total }`.
- [ ] Add two buttons to each card:
  - "Add to library" calls `POST /api/me/games` with `{ gameId, status }`, where status is `next`, `playing`, or `completed`.
  - "Add to wishlist" calls `POST /api/me/wishlist` with `{ gameId }`.
  - Both answer `409 CONFLICT` if the game is already there. Show that as "already added", not as a failure.

### 7. Profile

File: `src/components/Profile/` (empty).

- [ ] Show the signed-in user's name, username, and platform.
- [ ] **Library:** load `GET /api/me/games` and show three groups by `status`: Completed, Playing, and Next to Play. Each entry holds the full game under `game`.
- [ ] Let the user move a game between groups with `PATCH /api/me/games/:entryId` and `{ status }`, and remove it with `DELETE /api/me/games/:entryId`. Note that `:entryId` is the entry's `_id`, not the game's.
- [ ] **Wishlist:** load `GET /api/me/wishlist`, with a remove button calling `DELETE /api/me/wishlist/:itemId`.
- [ ] **Edit profile:** a form that sends any of `firstName`, `lastName`, `platform`, `username` to `PATCH /api/users/me`.
- [ ] **Other people's profiles** (`/users/:userId`): load `GET /api/users/:userId` and their posts from `GET /api/posts/user/:userId`. Add a Follow button (`POST /api/users/:userId/follow`) that becomes Unfollow (`DELETE` on the same path). To know which to show, check whether the user appears in `GET /api/users/<your id>/following`.

### 8. Feed

File: `src/components/Feed/` (empty).

- [ ] Load `GET /api/posts/feed` and show each post's `content`, its author's name, and the date. Posts are already sorted newest first and include `author` and, when linked to a game, `game` (`title` and `coverUrl`).
- [ ] Add a "new post" box that calls `POST /api/posts` with `{ content }` (1 to 2000 characters) and, optionally, a `gameId`. Put the new post at the top of the list without reloading the page.
- [ ] Let authors edit (`PATCH /api/posts/:postId`) and delete (`DELETE /api/posts/:postId`) their own posts. Compare `post.author._id` with the signed-in user's `_id` to decide whether to show the buttons.
- [ ] Make each author's name a link to `/users/:userId`.
- [ ] A brand-new account follows nobody, so its feed holds only its own posts. Show a friendly message for an empty feed.

### 9. NewsPanel

File: `src/components/NewsPanel/` (empty).

- [ ] Load `GET /api/news`. It needs no token, so it works for signed-out visitors too.
- [ ] Each item in `items` has `title`, `url`, and `source` (PlayStation Blog, Xbox Wire, or Steam). `summary`, `imageUrl`, and `publishedAt` are present on most items but not all, so handle them being missing.
- [ ] Show each as a link that opens in a new tab (`target="_blank" rel="noreferrer"`).
- [ ] Place the panel beside the feed on wide screens and below it on phones.
- [ ] If the request fails, show "News is unavailable right now" in the panel and leave the rest of the page working.

## Finishing touches

### 10. Loading, errors, and layout

- [ ] Show a loading state while each list is being fetched.
- [ ] Check every page at phone width (about 375px).
- [ ] Run `npm run lint` and fix what it reports.
- [ ] Remove the unused Vite starter files in `src/assets/` (`react.svg`, `vite.svg`) if nothing imports them.

### 11. Get ready for deployment

- [ ] Run `npm run build` and confirm it finishes without errors.
- [ ] Tell the backend pair the URL the client will be deployed at. We have to add it to the API's allowed origins, or the browser will block its requests.
