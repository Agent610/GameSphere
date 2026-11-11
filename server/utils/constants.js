// Values shared by several models and controllers. Keeping them in one place
// means the register form, the User model, and the Game model can never
// disagree about what a valid platform is.

// Must match the <option> values in client/src/pages/Register/Register.jsx.
export const PLATFORMS = ["PlayStation", "Xbox", "Nintendo", "PC", "Mobile"];

// Where a game sits in someone's library:
//   "next"      - planning to play it
//   "playing"   - currently playing
//   "completed" - finished
export const LIBRARY_STATUSES = ["next", "playing", "completed"];

// Public profile fields. Used whenever one user's data is shown to another,
// so private fields (email, password hash) are never included by accident.
export const PUBLIC_USER_FIELDS = "username firstName lastName platform";
