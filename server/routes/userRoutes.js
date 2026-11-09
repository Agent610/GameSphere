import express from "express";

const router = express.Router();

import {
  getAllUsers,
  getUserById,
  signup,
  login,
  updateProfile,
  deleteAccount,
} from "../controllers/userController.js";

router.get("/", getAllUsers);

router.get("/:userId", getUserById);

router.post("/signup", signup);

router.post("/login", login);

router.patch("/updateProfile", updateProfile);

router.delete("/deleteAccount", deleteAccount);

export default router;
