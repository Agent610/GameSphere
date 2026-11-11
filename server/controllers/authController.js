// Account creation and sign-in.
//
// Two ideas are worth knowing before reading this file:
//
// 1. Passwords are never stored. We store a bcrypt *hash*: a one-way scramble
//    that cannot be turned back into the password. At login, bcrypt hashes the
//    attempt the same way and compares the results.
//
// 2. After a successful register or login, the client gets a JWT (JSON Web
//    Token): a short signed string containing the user's id. The client sends it
//    back on later requests, and middleware/authMiddleware.js verifies it. The
//    server does not need to remember who is logged in.

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import validator from "validator";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { PLATFORMS } from "../utils/constants.js";
import { requireText, USERNAME_PATTERN } from "../utils/requestValidation.js";

const MIN_PASSWORD_LENGTH = 8;
// bcrypt only reads the first 72 bytes of its input, so a longer password would
// be silently cut short. Capping the length keeps behavior predictable.
const MAX_PASSWORD_LENGTH = 72;
// How much work bcrypt does per hash. Each +1 doubles the time, which slows down
// anyone trying to guess passwords from a stolen database. 12 takes roughly a
// quarter of a second.
const BCRYPT_COST = 12;

// Reads a password from the request without altering it. Unlike other text
// fields it is not trimmed: spaces are legitimate password characters.
function requirePassword(value) {
  if (typeof value !== "string" || !value) {
    throw new ApiError(400, "INVALID_INPUT", "password is required");
  }
  if (Buffer.byteLength(value) > MAX_PASSWORD_LENGTH) {
    throw new ApiError(400, "INVALID_INPUT", "password is too long");
  }

  return value;
}

// Builds a username from a person's name: "Alex", "Player" -> "alex.player".
// The register form does not ask for a username, so we need a sensible default.
function deriveUsername(firstName, lastName) {
  const derived = `${firstName}.${lastName}`
    .toLowerCase()
    // Drop anything that is not allowed in a username (spaces, accents, ...).
    .replace(/[^a-z0-9._-]/g, "")
    // Drop punctuation left dangling at either end.
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 32);
  // Some names leave too little behind to be a valid username (for example a
  // name written entirely in non-Latin characters). Fall back to a generic one.
  return USERNAME_PATTERN.test(derived) ? derived : "player";
}

// Creates the signed token returned by register and login.
// `sub` ("subject") is the standard JWT field for who the token belongs to.
function issueToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

// The account fields sent back to the account's own owner. Listing them by hand
// (an "allow-list") means a field added to the User model later stays private
// until someone deliberately adds it here.
function publicUser(user) {
  return {
    // Named `_id` to match every other document the API returns.
    _id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    platform: user.platform,
    createdAt: user.createdAt,
  };
}

// POST /api/auth/register
// Body: { firstName, lastName, email, password, platform, username? }
// Responds 201 with { token, user }.
export async function register(request, response) {
  // 1. Validate everything before touching the database.
  const firstName = requireText(request.body.firstName, "firstName", 64);
  const lastName = requireText(request.body.lastName, "lastName", 64);
  const email = requireText(request.body.email, "email", 254).toLowerCase();
  const password = requirePassword(request.body.password);
  const platform = requireText(request.body.platform, "platform", 32);

  // The username is optional. If the client did not send one, derive it.
  const usernameProvided = request.body.username !== undefined;
  let username = usernameProvided
    ? requireText(request.body.username, "username", 32).toLowerCase()
    : deriveUsername(firstName, lastName);

  if (!validator.isEmail(email)) {
    throw new ApiError(400, "INVALID_EMAIL", "Provide a valid email address");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ApiError(
      400,
      "WEAK_PASSWORD",
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    );
  }
  if (!USERNAME_PATTERN.test(username)) {
    throw new ApiError(
      400,
      "INVALID_USERNAME",
      "Username must be 3 to 32 valid characters",
    );
  }
  if (!PLATFORMS.includes(platform)) {
    throw new ApiError(
      400,
      "INVALID_PLATFORM",
      "Choose a supported gaming platform",
    );
  }

  // 2. Make sure the email and username are free.
  if (await User.exists({ email })) {
    throw new ApiError(409, "ACCOUNT_EXISTS", "Email is already in use");
  }
  if (usernameProvided) {
    // The user asked for this exact name, so tell them if it is taken.
    if (await User.exists({ username })) {
      throw new ApiError(409, "USERNAME_TAKEN", "Username is already in use");
    }
  } else {
    // We picked the name, so a clash is our problem to solve: two people named
    // Alex Player must both be able to sign up. Add four random digits
    // ("alex.player4821") and retry until a free one is found.
    const base = username.slice(0, 28); // leave room for the 4 digits
    for (let attempt = 0; await User.exists({ username }); attempt += 1) {
      if (attempt === 10) {
        throw new ApiError(409, "USERNAME_TAKEN", "Choose a username");
      }
      username = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    }
  }
  // Note: two requests arriving at the same instant could both pass the checks
  // above. The unique indexes on the User model are the final safeguard; the
  // loser gets a 409 CONFLICT from errorMiddleware.

  // 3. Hash the password and save the account.
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const user = await User.create({
    username,
    firstName,
    lastName,
    email,
    passwordHash,
    platform,
  });

  // 4. Sign the user in straight away by returning a token.
  response
    .status(201)
    .json({ token: issueToken(user.id), user: publicUser(user) });
}

// POST /api/auth/login
// Body: { email, password }
// Responds 200 with { token, user }.
export async function login(request, response) {
  const email = requireText(request.body.email, "email", 254).toLowerCase();
  const password = requirePassword(request.body.password);
  if (!validator.isEmail(email)) {
    throw new ApiError(400, "INVALID_EMAIL", "Provide a valid email address");
  }

  // passwordHash is hidden by default (see the User model), so ask for it here.
  const user = await User.findOne({ email }).select("+passwordHash");

  // The same error is returned whether the email is unknown or the password is
  // wrong. Separate messages would let someone test which emails have accounts.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new ApiError(
      401,
      "INVALID_CREDENTIALS",
      "Email or password is incorrect",
    );
  }

  response.json({ token: issueToken(user.id), user: publicUser(user) });
}

// GET /api/auth/me  (requires a token)
// Lets the client turn a stored token back into the signed-in user's details,
// for example after a page refresh.
export async function getCurrentUser(request, response) {
  // request.user.id was set by authMiddleware.
  const user = await User.findById(request.user.id);
  if (!user) {
    throw new ApiError(404, "USER_NOT_FOUND", "User not found");
  }

  response.json({ user: publicUser(user) });
}
