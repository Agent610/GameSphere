// Public profiles, plus editing and deleting your own account.
// (Signing up and logging in are in authController.js.)

import { User } from "../models/User.js";
import { UserGame } from "../models/UserGame.js";
import { WishlistItem } from "../models/WishlistItem.js";
import { Follow } from "../models/Follow.js";
import { Post } from "../models/Post.js";
import { ApiError } from "../utils/ApiError.js";
import { PLATFORMS, PUBLIC_USER_FIELDS } from "../utils/constants.js";
import {
  requireObjectId,
  requireText,
  USERNAME_PATTERN,
} from "../utils/requestValidation.js";

// What anyone may see on a profile page. Email is deliberately not included.
const profileFields = `${PUBLIC_USER_FIELDS} createdAt`;

// GET /api/users/:userId
// Responds with { user }.
export async function getUserById(request, response) {
  const userId = requireObjectId(request.params.userId, "userId");
  const user = await User.findById(userId).select(profileFields);
  if (!user) {
    throw new ApiError(404, "USER_NOT_FOUND", "User not found");
  }

  response.json({ user });
}

// PATCH /api/users/me  (requires a token)
// Body: any of { firstName, lastName, platform, username }
// Responds with the updated { user }.
export async function updateProfile(request, response) {
  // Copy across only the fields a user is allowed to change. Passing
  // request.body straight to the database would let a client overwrite anything,
  // including passwordHash.
  const updates = {};
  for (const field of ["firstName", "lastName", "platform", "username"]) {
    if (request.body[field] !== undefined) {
      updates[field] = requireText(request.body[field], field, 64);
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new ApiError(
      400,
      "INVALID_INPUT",
      "Provide at least one profile field",
    );
  }

  // Same rules as registration.
  if (updates.username !== undefined) {
    updates.username = updates.username.toLowerCase();
    if (!USERNAME_PATTERN.test(updates.username)) {
      throw new ApiError(
        400,
        "INVALID_USERNAME",
        "Username must be 3 to 32 valid characters",
      );
    }
  }
  if (updates.platform !== undefined && !PLATFORMS.includes(updates.platform)) {
    throw new ApiError(
      400,
      "INVALID_PLATFORM",
      "Choose a supported gaming platform",
    );
  }

  // The id comes from the verified token, never from the request, so a user can
  // only ever edit their own profile.
  //   returnDocument: "after" - return the document as it is after the update
  //   runValidators           - apply the schema rules to updates too
  // A username that is already taken fails the unique index and becomes a 409
  // CONFLICT in errorMiddleware.
  const user = await User.findByIdAndUpdate(request.user.id, updates, {
    returnDocument: "after",
    runValidators: true,
  }).select(profileFields);
  if (!user) {
    throw new ApiError(404, "USER_NOT_FOUND", "User not found");
  }

  response.json({ user });
}

// DELETE /api/users/me  (requires a token)
// Responds 204 (success, nothing to return).
export async function deleteAccount(request, response) {
  const userId = request.user.id;

  // MongoDB does not delete related documents for us, so remove everything that
  // belongs to this user first. Otherwise their posts would stay in other
  // people's feeds with no author, and follower counts would include a ghost.
  await Promise.all([
    UserGame.deleteMany({ user: userId }),
    WishlistItem.deleteMany({ user: userId }),
    // Both directions: people they follow, and people following them.
    Follow.deleteMany({ $or: [{ follower: userId }, { following: userId }] }),
    Post.deleteMany({ author: userId }),
  ]);
  // The account goes last, so if a step above fails the user can still sign in
  // and try again.
  await User.findByIdAndDelete(userId);
  response.status(204).end();
}
