// Protects routes that require a signed-in user.
//
// How sign-in works in this API:
//   1. POST /api/auth/register or /api/auth/login returns a token (a JWT).
//   2. The client stores it and sends it with later requests in a header:
//        Authorization: Bearer <token>
//   3. This middleware checks the token. If it is valid, the user's id is put on
//      `request.user.id` and the request continues to the controller.
//      If not, the request stops here with a 401 response.
//
// Usage in a routes file:
//   router.post("/", authMiddleware, createPost);

import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";

export default async function authMiddleware(request, response, next) {
  // Expect exactly "Bearer <token>".
  const authorization = request.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new ApiError(401, "UNAUTHENTICATED", "Bearer token required"));
  }

  // `jwt.verify` checks the signature (the token was issued by this server and
  // has not been altered) and the expiry date. It throws if either check fails.
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, {
      // Only accept the algorithm we sign with (see issueToken in authController).
      algorithms: ["HS256"],
    });
  } catch (error) {
    return next(
      new ApiError(401, "UNAUTHENTICATED", "Invalid or expired token"),
    );
  }

  // `sub` ("subject") is the user id we stored in the token at login.
  if (!mongoose.isValidObjectId(payload.sub)) {
    return next(
      new ApiError(401, "UNAUTHENTICATED", "Invalid or expired token"),
    );
  }

  // A token stays valid until it expires, even if the account is deleted in the
  // meantime. Looking the user up on every request closes that gap.
  const user = await User.findById(payload.sub).select("_id");
  if (!user) {
    return next(
      new ApiError(401, "UNAUTHENTICATED", "Account no longer exists"),
    );
  }

  request.user = { id: user.id };
  return next();
}
