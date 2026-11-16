// A "follow" relationship: `follower` follows `following`.
//
// Follows are one-directional, like most social apps. If Sam follows Riley,
// there is one document { follower: Sam, following: Riley }. Riley following
// Sam back would be a second document the other way round.

import mongoose from "mongoose";

const { Schema, model } = mongoose;

const followSchema = new Schema(
  {
    follower: { type: Schema.Types.ObjectId, ref: "User", required: true },
    following: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

// You can follow someone only once. This index also makes "who does X follow?"
// fast, which the feed needs on every load.
followSchema.index({ follower: 1, following: 1 }, { unique: true });
// Makes "who follows X?" fast, newest first.
followSchema.index({ following: 1, createdAt: -1 });

export const Follow = model("Follow", followSchema);
