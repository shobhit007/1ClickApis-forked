const express = require("express");
const { db } = require("../../config/firebase");
const { checkAuth } = require("../../middlewares/authMiddleware");
const moment = require("moment");
const { Timestamp, FieldValue } = require("firebase-admin/firestore");
const { userRoles } = require("../../data/commonData");
const { generateId } = require("../../utils/utils");
const { firestore } = require("firebase-admin");
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

    console.log("req.hierarchy", req.hierarchy);
    // leads for sales member
    if (req?.role?.includes("sales")) {
      leadSnap = await db
        .collection("leads")
        .where("createdAt", ">=", Timestamp.fromDate(startDate))
        .where("createdAt", "<=", Timestamp.fromDate(endDate))
        .where("salesExecutive", "==", req.email)
        .get();
    } else if (req?.hierarchy == "manager") {
      leadSnap = await db
        .collection("leads")
        .where("createdAt", ">=", Timestamp.fromDate(startDate))
        .where("createdAt", "<=", Timestamp.fromDate(endDate))
        .where("salesExecutive", "==", null)
        .get();
    } else if (req?.hierarchy == "teamLead") {
      let teamMemberSnap = await db
        .collection("users")
        .doc("internal_users")
        .collection("credentials")
        .where("leader", "==", req.userId)
        .get();

      let teamMembers = teamMemberSnap.docs.map((item) => item.id);
      console.log(teamMembers, "teamMembers");

      leadSnap = await db
        .collection("leads")
        .where("createdAt", ">=", Timestamp.fromDate(startDate))
        .where("createdAt", "<=", Timestamp.fromDate(endDate))
        .where("salesExecutive", "in", teamMembers)
        .get();
    } else {
      //leads for all members
      leadSnap = await db
        .collection("leads")
        .where("createdAt", ">=", Timestamp.fromDate(startDate))
        .where("createdAt", "<=", Timestamp.fromDate(endDate))
        .get();
    }

    // set the name of the salesmember and assigned by user from their unique id
    const leads = leadSnap.docs.map((doc) => doc.data());
    const usersSnap = await db
      .collection("users")
      .doc("internal_users")
      .collection("credentials")
      .get();
    const users = usersSnap.docs.map((doc) => doc.data());

    let modifiedLeads = [];

    for (let lead of leads) {
      if (lead?.salesExecutive) {
        let salesUser = users.find((user) => user.id == lead.salesExecutive);
        lead.salesExecutiveName = salesUser.name;
      }
      if (lead?.assignedBy) {
        let assignedByUser = users.find((user) => user.id == lead?.assignedBy);
        lead.assignedBy = assignedByUser?.name || null;
      }

      modifiedLeads.push(lead);
    }

    res.status(200).json({ leads: modifiedLeads, success: true });
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
    const assignedBy = req.userId || null;

    for (let lead of leads) {
      await db.collection("leads").doc(`1click${lead}`).update({
        salesExecutive: salesMember,
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

const getSalesTeamMembers = async (req, res) => {
  try {
    const salesDeptMembersSnap = await db
      .collection("users")
      .doc("internal_users")
      .collection("credentials")
      .where("department", "==", "sales")
      .get();

    const users = salesDeptMembersSnap.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));

    const userMap = {};

    users.forEach((user) => {
      userMap[user.id] = { ...user, teamMembers: [] };
    });

    const result = [];
    const orphans = [];
    users.forEach((user) => {
      if (user.senior) {
        if (userMap[user.senior]) {
          userMap[user.senior].teamMembers.push(userMap[user.id]);
        }
      } else {
        result.push(userMap[user.id]);
      }
    });

    users.forEach((user) => {
      if (!user.senior && userMap[user.id].teamMembers.length === 0) {
        orphans.push(userMap[user.id]);
      }
    });

    let finalData = [...result, ...orphans];

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
        .where("leadId", "==", parseInt(searchText))
        .get();
    } else if (searchBy == "companyName") {
      leadsSnap = await db
        .collection("leads")
        .where("company_name", "==", searchText)
        .get();
    } else {
      leadsSnap = await db
        .collection("leads")
        .where("phone_number", "==", parseInt(searchText))
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

const manupulateLeads = async (req, res) => {
  try {
    const leads = await db.collection("leads").get();

    const leadsData = leads.docs.map((item) => item.id);

    let batch = db.batch();
    let ref = db.collection("leads");

    for (let lead of leadsData) {
      let docRef = ref.doc(lead);
      batch.update(docRef, {
        salesExecutiveName: FieldValue.delete(),
        salesExecutive: FieldValue.delete(),
      });
    }

    await batch.commit();

    res.send("ok");
  } catch (error) {
    res.send(error.message);
  }
};

const manipulateUsers = async (req, res) => {
  try {
    const usersSnap = await db
      .collection("users")
      .doc("internal_users")
      .collection("credentials")
      .get();

    const users = usersSnap.docs.map((doc) => ({ ...doc.data(), id: doc.id }));

    const ref = db
      .collection("users")
      .doc("internal_users")
      .collection("credentials");
    const batch = db.batch();
    for (let i = 0; i < users.length; i++) {
      let user = users[i];
      const docId = user.id;
      delete user.id;

      let newId = `1CDI${i + 1}`;
      user.id = newId;
      console.log("user is", user);
      batch.set(ref.doc(newId), user);
      batch.delete(ref.doc(docId));
    }

    await batch.commit();
    res.send("ok");
  } catch (error) {
    res.send(error.message);
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
router.get("/getSalesTeamMembers", checkAuth, getSalesTeamMembers);
router.post("/getUpdateHistoryOfLead", checkAuth, getUpdateHistoryOfLead);
router.post("/globalSearch", checkAuth, globalSearch);
router.post("/createdManualLead", checkAuth, createdManualLead);
router.post("/getLeadDetails", checkAuth, getLeadDetails);
router.post("/manupulateLeads", manupulateLeads);

module.exports = { leads: router };
