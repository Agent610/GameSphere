// An error we expect and want the client to see, for example "wrong password"
// or "game not found".
//
// Controllers just `throw new ApiError(...)`. Express 5 forwards anything thrown
// inside a route handler (including async ones) to middleware/errorMiddleware.js,
// which turns it into the JSON error response.
//
//   statusCode - the HTTP status to send (400, 401, 404, ...)
//   code       - a stable machine-readable name the client can check, e.g. "GAME_NOT_FOUND"
//   message    - a human-readable sentence that is safe to show to the user
export class ApiError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}
