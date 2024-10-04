const express = require("express");
const { db } = require("../../config/firebase");
const { checkAuth } = require("../../middlewares/authMiddleware");
const moment = require("moment");
const { Timestamp } = require("firebase-admin/firestore");
const { userRoles } = require("../../data/commonData");
const { generateId } = require("../../utils/utils");
const multer = require("multer");
const xlsx = require("xlsx");
const upload = multer({ storage: multer.memoryStorage() });

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
    if (req?.role?.includes("sales")) {
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
      await db
        .collection("leads")
        .doc(`1click${lead}`)
        .update({
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

const getAllLeaders = async (req, res) => {
  try {
    const allLeadersSnap = await db
      .collection("users")
      .doc("internal_users")
      .collection("credentials")
      .where("hierarchy", "==", "teamLead")
      .get();

    const allLeaders = allLeadersSnap.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));

    let finalData = [];

    for (let leader of allLeaders) {
      let teamMemberSnap = await db
        .collection("users")
        .doc("internal_users")
        .collection("credentials")
        .where("manager", "==", leader.id)
        .get();

      let teamMembers = teamMemberSnap.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));

      finalData.push({
        name: leader.name || leader.email,
        role: leader.role,
        id: leader.id,
        teamMembers,
      });
    }

    res.status(200).send({ success: true, data: finalData });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};

// get update history of lead
const getUpdateHistoryOfLead = async (req, res) => {
  try {
    const { leadId } = req.body;

    const historySnap = await db
      .collection("leads")
      .doc(`1click${leadId}`)
      .collection("history")
      .orderBy("updatedAt", "desc")
      .get();

    const historyData = historySnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).send({ success: true, data: historyData });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};

const globalSearch = async (req, res) => {
  try {
    const { searchBy, searchText } = req.body;
    console.log("body in global search", req.body);

    let leadsSnap;

    if (searchBy == "leadId") {
      leadsSnap = await db
        .collection("leads")
        .where("leadId", "==", searchText)
        .get();
    } else {
      leadsSnap = await db
        .collection("leads")
        .where("phone_number", "==", searchText)
        .get();
    }

    let leads =
      leadsSnap?.docs.map((item) => ({ id: item.id, ...item.data() })) || [];

    res.status(200).send({ success: true, data: leads });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};

const createdManualLead = async (req, res) => {
  try {
    const body = req.body;
    const phone = parseInt(body.phone);

    const snapshot = await db
      .collection("leads")
      .where("phone", "==", phone)
      .get();
    if (!snapshot.empty) {
      return res
        .status(400)
        .send({ message: "Lead already exists", success: false });
    }

    const leadCount = await generateId("lead");
    const leadId = `1click${leadCount}`;
    const leadBody = {
      createdAt: Timestamp.fromDate(moment(body.date).toDate()),
      createdBy: req.email,
      leadId: leadId,
      lookingFor: body.lookingFor,
      companyName: body.companyName,
      contactPerson: body.contactPerson,
      phone: phone,
      altPhone: body.altPhone,
      email: body.email,
      city: body.city,
      requirement: body.requirement,
      profileScore: body.profileScore,
      salesMemberId: parseInt(body.salesMember),
      disposition: body.disposition,
      subDisposition: body.subDisposition,
      remarks: body.remarks,
      source: "manual",
      adType: "manual",
    };

    await db.collection("leads").doc(leadId).set(leadBody);
    await db.collection("leads").doc(leadId).collection("history").doc().set({
      source: "manual",
      adType: "manual",
      updatedAt: Timestamp.now(),
      updatedBy: req.email,
      disposition: body.disposition,
      subDisposition: body.subDisposition,
    });

    res
      .status(200)
      .send({ message: "Lead created successfully", success: true });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};

const importLeadsFromExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ message: "No file uploaded", success: false });
    }

    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    console.log("data", data);

    const batch = db.batch();

    // for (let row of data) {
    //   const leadCount = await generateId("lead");
    //   const leadId = `1click${leadCount}`;

    //   const leadBody = {
    //     createdAt: Timestamp.now(),
    //     createdBy: req.email,
    //     leadId: leadId,
    //     lookingFor: row.lookingFor || '',
    //     companyName: row.companyName || '',
    //     contactPerson: row.contactPerson || '',
    //     phone: row.phone || '',
    //     altPhone: row.altPhone || '',
    //     email: row.email || '',
    //     city: row.city || '',
    //     requirement: row.requirement || '',
    //     profileScore: row.profileScore || 0,
    //     salesMemberId: parseInt(row.salesMember) || 0,
    //     disposition: row.disposition || '',
    //     subDisposition: row.subDisposition || '',
    //     remarks: row.remarks || '',
    //     source: "excel_import",
    //     adType: "manual",
    //   };

    //   const leadRef = db.collection("leads").doc(leadId);
    //   batch.set(leadRef, leadBody);

    //   const historyRef = leadRef.collection("history").doc();
    //   batch.set(historyRef, {
    //     source: "excel_import",
    //     adType: "manual",
    //     updatedAt: Timestamp.now(),
    //     updatedBy: req.email,
    //     disposition: row.disposition || '',
    //     subDisposition: row.subDisposition || '',
    //   });
    // }

    // await batch.commit();

    res
      .status(200)
      .json({ message: "Leads imported successfully", success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message, success: false });
  }
};

const getLeadDetails = async (req, res) => {
  try {
    const body = req.body;
    const leadId = body.leadId;

    const leadSnap = await db.collection("leads").doc(`1click${leadId}`).get();
    const leadData = leadSnap.data();

    const detailsSnap = await db
      .collection("leads")
      .doc(`1click${leadId}`)
      .collection("details")
      .get();
    const leadDetails = {
      business: {},
      contact: {},
    };
    if (!detailsSnap.empty) {
      leadDetails = detailsSnap.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));
      leadDetails.business = leadDetails.find(
        (item) => item.id === "businessDetails"
      );
      leadDetails.contact = leadDetails.find(
        (item) => item.id === "contactDetails"
      );
    }

    const historySnap = await db
      .collection("leads")
      .doc(`1click${leadId}`)
      .collection("history")
      .orderBy("updatedAt", "desc")
      .get();

    const historyData = historySnap.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));

    const productsSnap = await db
      .collection("leads")
      .doc(`1click${leadId}`)
      .collection("products")
      .get();

    const products = productsSnap.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));

    res.status(200).send({
      success: true,
      data: { leadData, leadDetails, historyData, products },
    });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};

router.post(
  "/importLeadsFromExcel",
  upload.single("file"),
  importLeadsFromExcel
);
router.post("/getLeads", checkAuth, getLeads);
router.post("/assignLeadsToSalesMember", checkAuth, assignLeadsToSalesMember);
router.get("/getAllLeaders", checkAuth, getAllLeaders);
router.post("/getUpdateHistoryOfLead", checkAuth, getUpdateHistoryOfLead);
router.post("/globalSearch", checkAuth, globalSearch);
router.post("/createdManualLead", checkAuth, createdManualLead);
router.post("/getLeadDetails", checkAuth, getLeadDetails);

module.exports = { leads: router };
