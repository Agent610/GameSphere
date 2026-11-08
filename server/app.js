import express from "express";
import userRoutes from "./routes/userRoutes.js";
const app = express();
const port = 3000;

app.use("/users", userRoutes);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
