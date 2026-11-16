// A text update shown in the social feed, optionally about a specific game.

import mongoose from "mongoose";

const { Schema, model } = mongoose;

const postSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
    // Optional: the catalog game this post is about.
    game: { type: Schema.Types.ObjectId, ref: "Game" },
  },
  { timestamps: true },
);

// The feed and profile pages both ask for "posts by these authors, newest
// first". This index lets MongoDB answer that without scanning every post.
postSchema.index({ author: 1, createdAt: -1 });

export const Post = model("Post", postSchema);
