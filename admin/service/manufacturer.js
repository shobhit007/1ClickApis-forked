const express = require("express");
const { db, storage } = require("../../config/firebase");
const { checkAuth } = require("../../middlewares/authMiddleware");
const moment = require("moment");
const { Timestamp, FieldValue } = require("firebase-admin/firestore");
const multer = require("multer");

const router = express.Router();

const getAllocatedLeads = async (req, res) => {
  try {
    const snap = await db
      .collection("leads")
      .orderBy("updatedAt", "desc")
      .limit(10)
      .get();
    const data = snap.docs.map((item) => ({ ...item.data(), docId: item.id }));
    res.status(200).send({ success: true, data });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
};

router.post("/getAllocatedLeads", checkAuth, getAllocatedLeads);

module.exports = { manufacturer: router };
