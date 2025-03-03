const express = require("express");
const { db, storage } = require("../../config/firebase");
const { checkAuth } = require("../../middlewares/authMiddleware");
const moment = require("moment");
const { Timestamp, FieldValue } = require("firebase-admin/firestore");
const multer = require("multer");
const { getUniqueId } = require("../../utils/commonFunctions");

const router = express.Router();

const getAllocatedLeads = async (req, res) => {
  try {
    const { userLeadId, userType } = req;

    if (userType !== "manufacturer") {
      return res
        .status(403)
        .json({ message: "Unauthorized access", success: false });
    }

    const allocatedSnaps = await db
      .collection("service")
      .where("manufacturer", "==", userLeadId)
      .orderBy("assignedAt", "desc")
      .get();

    const allocatedData = allocatedSnaps.docs.map((item) => ({
      ...item.data(),
      serviceDocId: item.id,
    }));

    const chunkedArray = [];
    for (let i = 0; i < allocatedData.length; i += 50) {
      chunkedArray.push(allocatedData.slice(i, i + 50));
    }

    let allLeads = [];
    for (const chunk of chunkedArray) {
      const distributorIds = chunk.map((item) => item.distributor);
      console.log("distributorIds", distributorIds);
      const leadsSnap = await db
        .collection("leads")
        .where("leadId", "in", distributorIds)
        .get();

      console.log("leadsSnap", leadsSnap.docs.length);
      const leadsData = leadsSnap.docs.map((item) => {
        const lead = item.data();
        const allocatedItem = allocatedData.find(
          (allocated) => allocated.distributor === lead.leadId
        );

        if (allocatedItem) {
          let obj = { ...allocatedItem };
          delete obj.manufacturer;
          delete obj.distributor;
          return { ...lead, ...obj };
        }
        return lead;
      });
      allLeads = allLeads.concat(leadsData);
    }

    res.status(200).json({ success: true, data: allLeads });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
};

const updateAllocatedLead = async (req, res) => {
  try {
    const { serviceDocId, disposition, subDisposition, remarks } = req.body;
    const { userLeadId, userType } = req;
    console.log(
      "userLeadId: " + userLeadId,
      userType,
      disposition,
      serviceDocId
    );

    if (!userLeadId || !disposition) {
      return res
        .status(400)
        .send({ success: false, message: "Invalid request" });
    }

    if (!serviceDocId) {
      return res
        .status(400)
        .send({ success: false, message: "Invalid request" });
    }

    await db.collection("service").doc(serviceDocId).update({
      lastRemarks: remarks,
      disposition,
      subDisposition,
      updatedBy: userLeadId,
      updatedAt: Timestamp.now(),
    });

    await db.collection("service").doc(serviceDocId).collection("updates").add({
      remarks,
      disposition,
      subDisposition,
      updatedBy: userLeadId,
      userType,
      updatedAt: Timestamp.now(),
    });

    res.status(200).send({ success: true, message: "updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
};

const getAllUpdatesOfLead = async (req, res) => {
  try {
    const { serviceDocId, readStatus } = req.body;

    if (!serviceDocId) {
      return res
        .status(400)
        .send({ success: false, message: "Invalid request" });
    }

    const updatesSnap = await db
      .collection("service")
      .doc(serviceDocId)
      .collection("updates")
      .orderBy("updatedAt", "desc")
      .get();

    // if readStatus is false or not present then udpate the service doc
    let increasedReadCount = false;
    if (!readStatus) {
      await db.collection("service").doc(serviceDocId).update({
        readStatus: "read",
        readOn: Timestamp.now(),
      });
      increasedReadCount = true;
    }

    const updates = updatesSnap.docs.map((item) => item.data());

    res.status(200).send({ success: true, data: updates, increasedReadCount });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};

const addProduct = async (req, res) => {
  try {
    console.log("adding product", req.body);
    const product = req.body;
    const userLeadId = req.userLeadId;

    if (!userLeadId) {
      return res
        .status(400)
        .send({ success: false, message: "Invalid request" });
    }

    let productId = await getUniqueId();
    await db
      .collection("products")
      .doc(productId)
      .set({
        ...product,
        listedOn: Timestamp.now(),
        leadId: userLeadId,
        productId,
      });

    res
      .status(200)
      .send({ success: true, message: "Products added successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
};

const updateProduct = async (req, res) => {
  try {
    const body = req.body;
    const userLeadId = req.userLeadId;

    if (!userLeadId) {
      return res
        .status(400)
        .send({ success: false, message: "Invalid request" });
    }

    if (!body.productId) {
      return addProduct(req, res);
    }

    delete body.listedOn;
    await db
      .collection("products")
      .doc(body.productId)
      .update({
        ...body,
      });

    res
      .status(200)
      .send({ success: true, message: "Products updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
};

const getAllProductsOfUser = async (req, res) => {
  try {
    const userLeadId = req.userLeadId;
    if (!userLeadId) {
      return res
        .status(400)
        .send({ success: false, message: "Invalid request" });
    }

    const productsSnap = await db
      .collection("products")
      .where("leadId", "==", userLeadId)
      .orderBy("listedOn", "desc")
      .get();

    const products = productsSnap.docs.map((item) => item.data());

    res.status(200).send({ success: true, products });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
};

router.post("/getAllocatedLeads", checkAuth, getAllocatedLeads);
router.post("/getAllUpdatesOfLead", checkAuth, getAllUpdatesOfLead);
router.post("/updateAllocatedLead", checkAuth, updateAllocatedLead);
router.post("/addProduct", checkAuth, addProduct);
router.post("/updateProduct", checkAuth, updateProduct);
router.get("/getAllProductsOfUser", checkAuth, getAllProductsOfUser);

module.exports = { manufacturer: router };
