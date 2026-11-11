// Following other users, and listing who follows whom.
// Each follow is one Follow document: { follower, following } (see the model).

import { Follow } from "../models/Follow.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { PUBLIC_USER_FIELDS } from "../utils/constants.js";
import { requireObjectId } from "../utils/requestValidation.js";

// Shared by getFollowers and getFollowing, which differ only in which side of
// the relationship they look at:
//
//   direction     we search for documents where...   and return each one's...
//   "followers"   following === this user            follower
//   "following"   follower  === this user            following
async function listConnections(request, response, direction) {
  const userId = requireObjectId(request.params.userId, "userId");
  if (!(await User.exists({ _id: userId }))) {
    throw new ApiError(404, "USER_NOT_FOUND", "User not found");
  }

  const field = direction === "followers" ? "follower" : "following";
  const filter =
    direction === "followers" ? { following: userId } : { follower: userId };
  const connections = await Follow.find(filter)
    .sort({ createdAt: -1 })
    // Replace the stored user id with that user's public profile fields.
    .populate(field, PUBLIC_USER_FIELDS);
  response.json({ users: connections.map((connection) => connection[field]) });
}

// GET /api/users/:userId/followers
// Responds with { users } - the people who follow this user.
export function getFollowers(request, response) {
  return listConnections(request, response, "followers");
}

// GET /api/users/:userId/following
// Responds with { users } - the people this user follows.
export function getFollowing(request, response) {
  return listConnections(request, response, "following");
}

// POST /api/users/:userId/follow  (requires a token)
// The signed-in user starts following :userId. Responds 204.
export async function followUser(request, response) {
  const targetId = requireObjectId(request.params.userId, "userId");
  if (targetId === request.user.id) {
    throw new ApiError(400, "INVALID_FOLLOW", "You cannot follow yourself");
  }
  if (!(await User.exists({ _id: targetId }))) {
    throw new ApiError(404, "USER_NOT_FOUND", "User not found");
  }

  // "Upsert" = update the document if it exists, insert it if it does not.
  // That makes following someone twice harmless: the second request finds the
  // existing document and changes nothing, instead of failing on the unique index.
  await Follow.updateOne(
    { follower: request.user.id, following: targetId },
    { $setOnInsert: { follower: request.user.id, following: targetId } },
    { upsert: true },
  );
  response.status(204).end();
}

// DELETE /api/users/:userId/follow  (requires a token)
// The signed-in user stops following :userId. Responds 204, including when they
// were not following in the first place, since the end result is the same.
export async function unfollowUser(request, response) {
  const targetId = requireObjectId(request.params.userId, "userId");
  await Follow.deleteOne({ follower: request.user.id, following: targetId });
  response.status(204).end();
}
