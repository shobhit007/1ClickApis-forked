require("dotenv").config();
const express = require("express");
const app = express();

app.use(express.json());

// Admin Auth Routes
const { auth } = require("./admin/auth/auth");
app.use("/admin/auth", auth);

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
