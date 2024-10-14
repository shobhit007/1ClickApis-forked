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
    const leadId = body.leadId;

    const batch = db.batch();

    // for (let leadId of leads) {
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
        role: req.role || null,
      });
    // }

    await batch.commit();

    res
      .status(200)
      .json({ success: true, message: "Lead updated successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message, success: false });
  }
};

const updateBusinessDetails = async (req, res) => {
  try {
    const body = req.body;
    const leadId = body.leadId;
    delete body.leadId;

    await db
      .collection("leads")
      .doc(`1click${leadId}`)
      .collection("details")
      .doc("businessDetails")
      .set(body);

    res.status(200).json({
      success: true,
      message: "Business details updated successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
};
const contactDetails = async (req, res) => {
  try {
    const body = req.body;
    const leadId = body.leadId;
    delete body.leadId;

    await db
      .collection("leads")
      .doc(`1click${leadId}`)
      .collection("details")
      .doc("contactDetails")
      .set(body);

    res
      .status(200)
      .json({ success: true, message: "Contact details updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
};

const addProducts = async (req, res) => {
  try {
    const body = req.body;
    const leadId = body.leadId;
    delete body.leadId;

    await db
      .collection("leads")
      .doc(`1click${leadId}`)
      .collection("products")
      .add(body);

    res
      .status(200)
      .json({ success: true, message: "Products added successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
};

const updateProduct = async (req, res) => {
  try {
    const body = req.body;
    const productId = body.productId;
    const leadId = body.leadId;

    delete body.leadId;
    delete body.productId;

    await db
      .collection("leads")
      .doc(`1click${leadId}`)
      .collection("products")
      .doc(productId)
      .update(body);

    res
      .status(200)
      .json({ success: true, message: "Product updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
};

router.get("/getSalesMembers", checkAuth, getSalesMembers);
router.post("/updateLead", checkAuth, updateLead);
router.post("/updateBusinessDetails", checkAuth, updateBusinessDetails);
router.post("/contactDetails", checkAuth, contactDetails);
router.post("/addProducts", checkAuth, addProducts);
router.post("/updateProduct", checkAuth, updateProduct);

module.exports = { salesPanel: router };
