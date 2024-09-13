const express = require("express");
const { db } = require("../../config/firebase");
const { Timestamp } = require("@google-cloud/firestore");
const jwt = require("jsonwebtoken");

const router = express.Router();

const createAuth = async (req, res) => {
  const body = req.body;
  await db
    .collection("users")
    .doc("internal_users")
    .collection("credentials")
    .doc()
    .set({ ...body, createdAt: Timestamp.now() });

  res.status(200).send("User created successfully");
};

// Login for internal users
const logIn = async (req, res) => {
  try {
    const body = req.body;
    const email = body.email;
    const password = body.password;

    const userSnap = await db
      .collection("users")
      .doc("internal_users")
      .collection("credentials")
      .where("email", "==", email)
      .get();

    if (userSnap.empty) {
      return res.status(404).send("User not found");
    }

    const user = userSnap.docs[0].data();

    if (user.password !== password) {
      return res.status(401).send("Invalid email or password");
    }

    const token = jwt.sign(
      { email: user.email, password: user.password },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).send({ token, role: user.role });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: error.message });
  }
};

router.post("/createAuth", createAuth);
router.post("/login", logIn);

module.exports = { auth: router };
