import mongoose from "mongoose";
import validator from "validator";
const { Schema, model } = mongoose;

const UserSchema = new Schema({
  _id: Schema.Types.UUID,
  username: {
    type: String,
    required: true,
    unique: true,
    minLength: 1,
    maxLength: 64,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    validate: [validator.isEmail, "Please provide a valid email address"],
  },
  password: {
    type: String,
    required: true,
    minLength: 8,
    maxLength: 128,
    validate: validator.isStrongPassword(),
  },
  createdAt: { type: Date, default: Date.now },
  /* 
  Other fields may include: 
  - wishlist
  - games played
  - friends
  - messages
  - likes

  Other attributes 
  Password: see docs - https://www.npmjs.com/package/validator
   */
});

export const User = model("User", UserSchema);
