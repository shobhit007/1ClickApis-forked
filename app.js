require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");

app.use(express.json());

app.use(cors());

app.use(function (req, res, next) {
  console.log("url requested", req.originalUrl);
  return next();
});


// Admin Auth Routes
const { auth } = require("./admin/auth/auth");
app.use("/admin/auth", auth);

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
