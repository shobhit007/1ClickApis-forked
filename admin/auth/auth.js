const express = require("express");
const { db } = require("../../config/firebase");
const { Timestamp } = require("@google-cloud/firestore");
const jwt = require("jsonwebtoken");
const { checkAuth } = require("../../middlewares/authMiddleware");
const { generateId } = require("../../utils/utils");
const { sendEmail, generateOTP } = require("../../utils/email");

const router = express.Router();

const createAuth = async (req, res) => {
  try {
    const body = req.body;

    if (body.role.includes("sales")) {
      const salesId = await generateId("sales");
      body.salesMemberId = salesId;
    }

    await db
      .collection("users")
      .doc("internal_users")
      .collection("credentials")
      .doc()
      .set({ ...body, createdAt: Timestamp.now() });

    res
      .status(200)
      .send({ message: "User created successfully", success: true });
  } catch (error) {
    res.status(500).send({ message: error.message, success: false });
  }
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
      return res
        .status(404)
        .send({ success: false, message: "User not found" });
    }

    const user = userSnap.docs[0].data();

    if (user.password !== password) {
      return res
        .status(401)
        .send({ success: false, message: "Invalid email or password" });
    }

    if (!user.isActive) {
      return res
        .status(401)
        .send({ success: false, message: "You are not authorized" });
    }

    const jwtPayload = {
      email: user.email,
      name: user.name,
    };

    if (user.role) {
      jwtPayload.role = user.role;
    }

    const token = jwt.sign(jwtPayload, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.status(200).send({ token, success: true, role: user.role });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: error.message, success: false });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await db
      .collection("users")
      .doc("internal_users")
      .collection("credentials")
      .get();
    res.status(200).send({
      users: users.docs.map((doc) => ({ ...doc.data(), id: doc.id })),
      success: true,
    });
  } catch (error) {
    res.status(500).send({ message: error.message, success: false });
  }
};

const updateUser = async (req, res) => {
  try {
    const body = req.body;
    const email = body.email;
    const userSnap = await db
      .collection("users")
      .doc("internal_users")
      .collection("credentials")
      .where("email", "==", email)
      .get();

    const userId = userSnap.docs[0].id;
    await db
      .collection("users")
      .doc("internal_users")
      .collection("credentials")
      .doc(userId)
      .update(body);

    res.status(200).send({
      message: "User updated successfully",
      success: true,
    });
  } catch (error) {
    res.status(500).send({ message: error.message, success: false });
  }
};

const sendEmailOtp = async (req, res) => {
  try {
    const email = req.body.email;

    const snapshot = await db
      .collection("users")
      .doc("internal_users")
      .collection("credentials")
      .where("email", "==", email)
      .get();

    if (snapshot.empty) {
      return res
        .status(404)
        .send({ message: "User not found", success: false });
    }

    const otp = generateOTP();
    console.log("otp", otp);

    const subject = "Your OTP Code for Password Reset";
    const text = `Your one-time password (OTP) for resetting your password is: ${otp}`;

    const status = await sendEmail({
      email: email,
      subject,
      text,
    });

    if (!status) {
      return res
        .status(500)
        .send({ message: "Something went wrong", success: false });
    }

    const token = jwt.sign({ otp }, process.env.JWT_SECRET, {
      expiresIn: "10m",
    });

    res.status(200).send({
      message: "OTP sent successfully",
      success: true,
      otpToken: token,
    });
  } catch (error) {
    res.status(500).send({ message: error.message, success: false });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const otp = req.body.otp;
    const otpToken = req.body.otpToken;

    const decoded = jwt.verify(otpToken, process.env.JWT_SECRET);

    if (parseInt(decoded.otp) !== parseInt(otp)) {
      return res.status(401).send({ message: "Invalid OTP", success: false });
    }

    res.status(200).send({
      message: "OTP verified successfully",
      success: true,
    });
  } catch (error) {
    res.status(500).send({ message: error.message, success: false });
  }
};

const resetPassword = async (req, res) => {
  try {
    const body = req.body;
    const email = body.email;
    const password = body.password;

    const snapshot = await db
      .collection("users")
      .doc("internal_users")
      .collection("credentials")
      .where("email", "==", email)
      .get();
    const userId = snapshot.docs[0].id;

    await db
      .collection("users")
      .doc("internal_users")
      .collection("credentials")
      .doc(userId)
      .update({ password });

    res
      .status(200)
      .send({ message: "Password reset successfully", success: true });
  } catch (error) {
    res.status(500).send({ message: error.message, success: false });
  }
};

const getUserDetails = async (req, res) => {
  try {
    const email = req.email;

    const userSnap = await db
      .collection("users")
      .doc("internal_users")
      .collection("credentials")
      .where("email", "==", email)
      .get();

    if (userSnap.docs.length == 0) {
      return res
        .status(404)
        .send({ message: "User not found", success: false });
    }

    let userData = userSnap.docs[0].data();
    return res.status(200).send({ success: true, data: userData });
  } catch (error) {
    res.status(500).send({ message: error.message, success: false });
  }
};

router.post("/login", logIn);
router.post("/createAuth", checkAuth, createAuth);
router.post("/updateUser", checkAuth, updateUser);
router.get("/getAllUsers", checkAuth, getAllUsers);
router.post("/sendEmailOtp", sendEmailOtp);
router.post("/verifyOtp", verifyOtp);
router.post("/resetPassword", resetPassword);
router.get("/getUserDetails", checkAuth, getUserDetails);

module.exports = { auth: router };
