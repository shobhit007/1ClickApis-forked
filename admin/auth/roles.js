const express = require("express");
const { db } = require("../../config/firebase");
const { FieldValue } = require("firebase-admin/firestore");
const { checkAuth } = require("../../middlewares/authMiddleware");

const router = express.Router();

const assignRole = async (req, res) => {
  const role = req.body.role;
  const email = req.body.email;

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
    .update({ role });

  res.status(200).send("Role assigned successfully");
};

const createRole = async (req, res) => {
  try {
    const role = req.body.role;

    await db
      .collection("users")
      .doc("rolesAndPermissions")
      .collection("roles")
      .doc(role)
      .set({
        permissions: [],
      });

    res
      .status(200)
      .send({ message: "Role created successfully", success: true });
  } catch (error) {
    res.status(500).send({ message: error.message, success: false });
  }
};

const assignPanelToRole = async (req, res) => {
  try {
    const role = req.body.role;
    const panel = req.body.panel;

    await db
      .collection("users")
      .doc("rolesAndPermissions")
      .collection("roles")
      .doc(role)
      .update({
        permissions: FieldValue.arrayUnion(panel),
      });

    res
      .status(200)
      .send({ message: "Panel assigned to role successfully", success: true });
  } catch (error) {
    res.status(500).send({ message: error.message, success: false });
  }
};
const getRoles = async (req, res) => {
  try {
    const snapshot = await db
      .collection("users")
      .doc("rolesAndPermissions")
      .collection("roles")
      .get();
    const roles = snapshot.docs.map((doc) => doc.id);
    res.status(200).send({ roles, success: true });
  } catch (error) {
    res.status(500).send({ message: error.message, success: false });
  }
};

router.post("/assignRole", checkAuth, assignRole);
router.post("/createRole", checkAuth, createRole);
router.post("/assignPanelToRole", checkAuth, assignPanelToRole);
router.get("/getRoles", checkAuth, getRoles);
module.exports = { roles: router };
