const express = require("express");
const { db } = require("../../config/firebase");
const { checkAuth } = require("../../middlewares/authMiddleware");
const { Timestamp } = require("firebase-admin/firestore");
const moment = require("moment");
const router = express.Router();

const getSalesMembers = async (req, res) => {
  try {
    const snapshot = await db
      .collection("users")
      .doc("internal_users")
      .collection("credentials")
      .where("role", "==", "salesMember")
      .get();

    const salesMembers = snapshot.docs.map((doc) => doc.data());

    res.status(200).json({ salesMembers, success: true });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
};

const updateLead = async (req, res) => {
  try {
    const body = req.body;
    const leads = body.leads;
    const followUpDate = Timestamp.fromDate(moment(body.followUpDate).toDate());
    body.followUpDate = followUpDate;

    const batch = db.batch();

    for (let leadId of leads) {
      const leadRef = db.collection("leads").doc(`1click${leadId}`);
      const historyRef = db
        .collection("leads")
        .doc(`1click${leadId}`)
        .collection("history")
        .doc();
      delete body.leads;
      batch.update(leadRef, { ...body, updatedAt: Timestamp.now() });
      batch.set(historyRef, {
        ...body,
        updatedAt: Timestamp.now(),
        updatedBy: req.email,
        role: req.role,
      });
    }

    await batch.commit();

    res
      .status(200)
      .json({ success: true, message: "Lead updated successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message, success: false });
  }
};

router.get("/getSalesMembers", checkAuth, getSalesMembers);
router.post("/updateLead", checkAuth, updateLead);

module.exports = { salesPanel: router };
