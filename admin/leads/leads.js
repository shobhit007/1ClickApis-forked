const express = require("express");
const { db } = require("../../config/firebase");
const { checkAuth } = require("../../middlewares/authMiddleware");
const moment = require("moment");
const { Timestamp } = require("firebase-admin/firestore");

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

    const snapshot = await db
      .collection("leads")
      .where("createdAt", ">=", Timestamp.fromDate(startDate))
      .where("createdAt", "<=", Timestamp.fromDate(endDate))
      .get();
    const leads = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    res.status(200).json({ leads, success: true });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
};

// Assign leads to sales member
const assignLeadsToSalesMember = async (req, res) => {
  try {
    const leads = req.body.leads;
    const salesMember = req.body.salesMember;
    for (let lead of leads) {
      await db.collection("leads").doc(lead).update({
        salesExecutive: salesMember,
      });
    }

    res
      .status(200)
      .send({ message: "Leads assigned successfully", success: true });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
};

router.post("/getLeads", checkAuth, getLeads);
router.post("/assignLeadsToSalesMember", checkAuth, assignLeadsToSalesMember);

module.exports = { leads: router };
