const express = require("express");
const { db } = require("../../config/firebase");
const { checkAuth } = require("../../middlewares/authMiddleware");
const moment = require("moment");
const { Timestamp } = require("firebase-admin/firestore");
const { userRoles } = require("../../data/commonData");

const router = express.Router();

// Get all leads
const getLeads = async (req, res) => {
  try {
    const body = req.body;
    const startDate = body.startDate
      ? moment(body.startDate).startOf("day").toDate()
      : moment().startOf("day").toDate();
    const endDate = body.endDate
      ? moment(body.endDate).endOf("day").toDate()
      : moment().endOf("day").toDate();

    let leadSnap = null;

    // leads for sales member
    if (req.role.includes("sales")) {
      leadSnap = await db
        .collection("leads")
        .where("createdAt", ">=", Timestamp.fromDate(startDate))
        .where("createdAt", "<=", Timestamp.fromDate(endDate))
        .where("salesExecutive", "==", req.email)
        .get();
    } else {
      //leads for all members
      leadSnap = await db
        .collection("leads")
        .where("createdAt", ">=", Timestamp.fromDate(startDate))
        .where("createdAt", "<=", Timestamp.fromDate(endDate))
        .get();
    }

    const leads = leadSnap.docs.map((doc) => doc.data());

    res.status(200).json({ leads, success: true });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
};

// Assign leads to sales member
const assignLeadsToSalesMember = async (req, res) => {
  try {
    const body = req.body;
    const leads = body.leads;
    const salesMember = body.salesMember;
    const salesMemberName = body.salesMemberName;
    const assignedBy = req.email;

    for (let lead of leads) {
      await db.collection("leads").doc(`1click${lead}`).update({
        salesExecutive: salesMember,
        salesExecutiveName: salesMemberName || null,
        assignedBy: assignedBy,
        assignedAt: Timestamp.now(),
      });
    }

    res
      .status(200)
      .send({ message: "Leads assigned successfully", success: true });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
};

// get all managers and their team members

const getAllManagers = async (req, res) => {
  try {
    let mangerRoles = userRoles.filter((role) => role.includes("Manager"));
    console.log("mangerRoles: ", mangerRoles);

    const allMangersSnap = await db
      .collection("users")
      .doc("internal_users")
      .collection("credentials")
      .where("role", "in", mangerRoles)
      .get();

    const allMangers = allMangersSnap.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));

    let finalData = [];

    for (let manager of allMangers) {
      let teamMemberSnap = await db
        .collection("users")
        .doc("internal_users")
        .collection("credentials")
        .where("manager", "==", manager.id)
        .get();

      let teamMembers = teamMemberSnap.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));

      finalData.push({
        name: manager.name || manager.email,
        role: manager.role,
        id: manager.id,
        teamMembers,
      });
    }

    res.status(200).send({ success: true, data: finalData });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};
router.post("/getLeads", checkAuth, getLeads);
router.post("/assignLeadsToSalesMember", checkAuth, assignLeadsToSalesMember);
router.get("/getAllManagers", checkAuth, getAllManagers);

module.exports = { leads: router };
