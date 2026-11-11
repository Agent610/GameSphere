# GameSphere 🎮

GameSphere is a full-stack social platform designed for gamers to share their gaming journeys, connect with other players, and organize their gaming libraries in one place.

## Overview

GameSphere combines social networking with game tracking, allowing users to follow other gamers and gaming channels, discover updates through a personalized feed, showcase completed games, plan their next gaming adventures, and maintain a wishlist across multiple gaming platforms.

## Core Features

- **User Accounts:** Sign in and access a personalized gaming profile.
- **Social Feed:** View updates from followed users and gaming channels.
- **Completed Games:** Showcase games you've finished on your profile.
- **Next to Play:** Organize upcoming games across Nintendo Switch, Xbox, PlayStation, PC, and mobile platforms.
- **Gaming Wishlist:** Save games you want to play or acquire and identify the platform you're interested in.

## Tech Stack

- **Frontend:** React
- **Backend:** Node.js and Express
- **Database:** MongoDB

## Repository Layout

```
GameSphere/
├── client/   React app (Vite)
└── server/   Express API backed by MongoDB
```

## Getting Started

You need [Node.js](https://nodejs.org/) 20.19 or newer and a MongoDB database (a local install or a free MongoDB Atlas cluster).

**1. Start the API**

```sh
cd server
npm install
cp .env.example .env    # then set MONGODB_URI and JWT_SECRET in .env
npm run dev             # http://localhost:3000
```

**2. Start the client** (in a second terminal)

```sh
cd client
npm install
npm run dev             # http://localhost:5173
```

The full backend guide, covering configuration, every API route, the data model, and how the code is organized, is in [server/README.md](server/README.md).

## Project Status

GameSphere is currently in the initial development and planning stage. Features and implementation details will evolve as the team collaborates on the application.

- **Backend:** the API for accounts, the game catalog, libraries, wishlists, follows, posts, and the feed is implemented and tested.
- **Frontend:** the login and registration forms exist but are not yet connected to the API. The feed, profile, game list, and news components are still to be built.

## Vision

Our goal is to create a community where gamers can share their progress, discover what others are playing, plan their next adventures, and keep their gaming lives organized across platforms.

### Social Feed and Official Gaming News

GameSphere provides a personalized feed that brings together updates from followed gamers and official gaming news channels.

- **Following:** See posts and gaming activity from people you follow.
- **Official News:** Keep up with announcements, game releases, updates, and industry news from official gaming sources.
- **Personalized Experience:** Bring social activity and gaming news together in one convenient feed.

## Contributors

- Devin Bhavsar
- Alejandro Jimenez
- Matthew Richards
- John Siordia
