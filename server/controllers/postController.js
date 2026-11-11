// Posts and the social feed.

import { Follow } from "../models/Follow.js";
import { Game } from "../models/Game.js";
import { Post } from "../models/Post.js";
import { ApiError } from "../utils/ApiError.js";
import { PUBLIC_USER_FIELDS } from "../utils/constants.js";
import { getPagination } from "../utils/pagination.js";
import { requireObjectId, requireText } from "../utils/requestValidation.js";

// A post stores only the ids of its author and game. This swaps those ids for
// the details the client needs to draw a post card: who wrote it, and which
// game it is about. Only public author fields are included (no email).
// It works on both a query (Post.find(...)) and a saved document.
const populatedPost = (target) =>
  target.populate([
    { path: "author", select: PUBLIC_USER_FIELDS },
    { path: "game", select: "title coverUrl" },
  ]);

// Fetches one page of posts matching `filter`, newest first, with the total
// count for pagination. Shared by the feed and the per-user post list.
async function findPosts(filter, { page, limit, skip }) {
  const [posts, total] = await Promise.all([
    populatedPost(
      Post.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ),
    Post.countDocuments(filter),
  ]);
  return { posts, pagination: { page, limit, total } };
}

// GET /api/posts/feed?page=&limit=  (requires a token)
// Responds with { posts, pagination }.
// The feed is your own posts plus posts from everyone you follow.
export async function getFeed(request, response) {
  // Step 1: find who the signed-in user follows. `.lean()` returns plain
  // objects instead of full Mongoose documents, which is faster when we only
  // need to read one field.
  const follows = await Follow.find({ follower: request.user.id })
    .select("following")
    .lean();

  // Step 2: fetch posts written by any of those people, or by the user.
  const authorIds = [
    request.user.id,
    ...follows.map((follow) => follow.following),
  ];
  response.json(
    await findPosts(
      { author: { $in: authorIds } },
      getPagination(request.query),
    ),
  );
}

// GET /api/posts/user/:userId?page=&limit=
// Responds with { posts, pagination } - one user's posts, for a profile page.
export async function getUserPosts(request, response) {
  const userId = requireObjectId(request.params.userId, "userId");
  response.json(
    await findPosts({ author: userId }, getPagination(request.query)),
  );
}

// POST /api/posts  (requires a token)
// Body: { content, gameId? }
// Responds 201 with { post }.
export async function createPost(request, response) {
  const content = requireText(request.body.content, "content", 2000);

  // Linking a game is optional, but if an id is sent it must be a real game.
  let game;
  if (request.body.gameId !== undefined && request.body.gameId !== null) {
    game = requireObjectId(request.body.gameId, "gameId");
    if (!(await Game.exists({ _id: game }))) {
      throw new ApiError(404, "GAME_NOT_FOUND", "Game not found");
    }
  }

  // The author is always the signed-in user, taken from the token.
  const post = await Post.create({ author: request.user.id, content, game });
  await populatedPost(post);
  response.status(201).json({ post });
}

// PATCH /api/posts/:postId  (requires a token; author only)
// Body: any of { content, gameId }. Send "gameId": null to remove the game link.
// Responds with the updated { post }.
export async function updatePost(request, response) {
  const postId = requireObjectId(request.params.postId, "postId");

  // MongoDB changes a field with $set and removes one with $unset, so collect
  // the two kinds of change separately.
  const set = {};
  const unset = {};
  if (request.body.content !== undefined) {
    set.content = requireText(request.body.content, "content", 2000);
  }
  if (request.body.gameId !== undefined) {
    if (request.body.gameId === null) {
      unset.game = 1;
    } else {
      set.game = requireObjectId(request.body.gameId, "gameId");
      if (!(await Game.exists({ _id: set.game }))) {
        throw new ApiError(404, "GAME_NOT_FOUND", "Game not found");
      }
    }
  }
  if (Object.keys(set).length === 0 && Object.keys(unset).length === 0) {
    throw new ApiError(400, "INVALID_INPUT", "Provide post content or gameId");
  }

  // Only include the operators that have something to do.
  const update = {};
  if (Object.keys(set).length) update.$set = set;
  if (Object.keys(unset).length) update.$unset = unset;

  // Filtering on the author as well as the id is the permission check: if the
  // post belongs to someone else nothing matches, and they get a 404.
  const post = await Post.findOneAndUpdate(
    { _id: postId, author: request.user.id },
    update,
    { returnDocument: "after", runValidators: true },
  );
  if (!post) {
    throw new ApiError(404, "POST_NOT_FOUND", "Post not found");
  }

  await populatedPost(post);
  response.json({ post });
}

// DELETE /api/posts/:postId  (requires a token; author only)
// Responds 204.
export async function deletePost(request, response) {
  const postId = requireObjectId(request.params.postId, "postId");
  const result = await Post.deleteOne({ _id: postId, author: request.user.id });
  if (!result.deletedCount) {
    throw new ApiError(404, "POST_NOT_FOUND", "Post not found");
  }

  response.status(204).end();
}
