const express = require("express");
const { db } = require("../../config/firebase");
const { FieldValue } = require("firebase-admin/firestore");
const { checkAuth } = require("../../middlewares/authMiddleware");
const { firestore } = require("firebase-admin");

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
    const panels = req.body.panels;

    await db
      .collection("users")
      .doc("rolesAndPermissions")
      .collection("roles")
      .doc(role)
      .update({
        permissions: panels,
      });

    res
      .status(200)
      .send({ message: "Panel assigned to role successfully", success: true });
  } catch (error) {
    res.status(500).send({ message: error.message, success: false });
  }
};
const getAllRoles = async (req, res) => {
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

const getRolePanels = async (req, res) => {
  try {
    const role = req.role;
    const roleSnap = await db
      .collection("users")
      .doc("rolesAndPermissions")
      .collection("roles")
      .doc(role)
      .get();
    const permissions = roleSnap.data().permissions;
    res.status(200).send({ id: role, panels: permissions, success: true });
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
    const roles = snapshot.docs.map((doc) => ({
      panels: doc.data().permissions,
      id: doc.id,
    }));

    res.status(200).send({ roles });
  } catch (error) {
    res.status(500).send({ message: error.message, success: false });
  }
};

router.post("/assignRole", checkAuth, assignRole);
router.post("/createRole", checkAuth, createRole);
router.post("/assignPanelToRole", checkAuth, assignPanelToRole);
router.get("/getAllRoles", getAllRoles);
router.get("/getRolePanels", checkAuth, getRolePanels);
router.get("/getRoles", getRoles);
module.exports = { roles: router };
