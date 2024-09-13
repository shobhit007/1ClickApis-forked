require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");

app.use(express.json());

app.use(cors());

// Admin Auth Routes
const { auth } = require("./admin/auth/auth");
app.use("/admin/auth", auth);
const { roles } = require("./admin/auth/roles");
app.use("/admin/roles", roles);

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
