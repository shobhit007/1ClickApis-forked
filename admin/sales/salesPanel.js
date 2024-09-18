const express = require("express");
const { db } = require("../../config/firebase");
const { checkAuth } = require("../../middlewares/authMiddleware");
const { Timestamp } = require("firebase-admin/firestore");
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

const addFollowUpDate = async (req, res) => {
  try {
    const leadId = req.body.leadId;
    const date = moment(req.body.date);

    await db
      .collection("leads")
      .doc(`1click${leadId}`)
      .update({
        followUpDate: Timestamp.fromDate(date.toDate()),
      });

    res
      .status(200)
      .json({ success: true, message: "Follow up date added successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
};

const updateLeadStage = async (req, res) => {
  try {
    const leadId = req.body.leadId;
    const stage = req.body.stage;

    await db.collection("leads").doc(`1click${leadId}`).update({
      stage: stage,
    });

    res
      .status(200)
      .json({ success: true, message: "Lead stage updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
};

router.get("/getSalesMembers", checkAuth, getSalesMembers);
router.post("/addFollowUpDate", checkAuth, addFollowUpDate);
router.post("/updateLeadStage", checkAuth, updateLeadStage);

module.exports = { salesPanel: router };
