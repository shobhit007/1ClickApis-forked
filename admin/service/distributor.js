const express = require("express");
const { db, storage } = require("../../config/firebase");
const { checkAuth } = require("../../middlewares/authMiddleware");
const { Timestamp, FieldValue } = require("firebase-admin/firestore");
const moment = require("moment");
const { getTeamMembersOfUser } = require("../../utils/utils");

const router = express.Router();

const getLeads = async (req, res) => {
  try {
    const body = req.body;
    const startDate = moment(body.startDate, "YYYY-MM-DD")
      .startOf("day")
      .toDate();
    const endDate = moment(body.endDate, "YYYY-MM-DD").endOf("day").toDate();
    const value = body.value;

    const userDepartment = req.department;
    const userRole = req.hierarchy;
    const userId = req.userId;

    const allUsersSnap = await db
      .collection("users")
      .doc("internal_users")
      .collection("credentials")
      .get();

    const allUsers = allUsersSnap.docs.map((item) => item.data());

    const allUsersByIds = {};
    allUsers.forEach((user) => {
      allUsersByIds[user.id] = user;
    });

    const allLeads = [];
    const getTeamMembers = await getTeamMembersOfUser(userId, allUsers);
    let allTeamMemberIds = [];

    if (value === "welcome_calls") {
      if (
        userRole === "superAdmin" ||
        (userDepartment === "Clients Service" && userRole === "Vice President")
      ) {
        console.log("getting leads...");
        const snapshot = await db
          .collection("leads")
          // .where("createdAt", ">=", Timestamp.fromDate(startDate))
          // .where("createdAt", "<=", Timestamp.fromDate(endDate))
          .where("are_you_in_business_?", "!=", null)
          .get();

        const leads = snapshot.docs.map((doc) => doc.data());
        allLeads.push(...leads);
      } else {
        if (Array.isArray(getTeamMembers)) {
          allTeamMemberIds = getTeamMembers?.map((user) => user.id);
        }
        allTeamMemberIds.push(userId);

        for (let teamMemberId of allTeamMemberIds) {
          const snapshot = await db
            .collection("leads")
            .where("createdAt", ">=", Timestamp.fromDate(startDate))
            .where("createdAt", "<=", Timestamp.fromDate(endDate))
            .where("serviceExecutive", "==", teamMemberId)
            .where("are_you_in_business_?", "!=", null)
            .get();

          const leads = snapshot.docs.map((doc) => doc.data());
          allLeads.push(...leads);
        }
      }
    } else if (value === "my_allocations") {
      if (
        userRole === "superAdmin" ||
        (userDepartment === "Clients Service" && userRole === "Vice President")
      ) {
        const snapshot = await db
          .collection("leads")
          // .where("createdAt", ">=", Timestamp.fromDate(startDate))
          // .where("createdAt", "<=", Timestamp.fromDate(endDate))
          .where("are_you_in_business_?", "!=", null)
          .where("welcomeCall", "==", true)
          .get();

        const leads = snapshot.docs.map((doc) => doc.data());
        allLeads.push(...leads);
      } else {
        if (Array.isArray(getTeamMembers)) {
          allTeamMemberIds = getTeamMembers?.map((user) => user.id);
        }
        allTeamMemberIds.push(userId);

        for (let teamMemberId of allTeamMemberIds) {
          const snapshot = await db
            .collection("leads")
            .where("createdAt", ">=", Timestamp.fromDate(startDate))
            .where("createdAt", "<=", Timestamp.fromDate(endDate))
            .where("serviceExecutive", "==", teamMemberId)
            .where("are_you_in_business_?", "!=", null)
            .where("welcomeCall", "==", true)
            .get();

          const leads = snapshot.docs.map((doc) => doc.data());
          allLeads.push(...leads);
        }
      }
    }

    console.log(allLeads.length);

    res.status(200).json({ leads: allLeads, success: true });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message, success: false });
  }
};

const getAllocatedLeads = async (req, res) => {
  try {
    const { userLeadId, userType } = req;

    console.log("user type is", userType);

    if (userType !== "distributor") {
      return res
        .status(403)
        .json({ message: "Unauthorized access", success: false });
    }

    const allocatedSnaps = await db
      .collection("service")
      .where("distributor", "==", userLeadId)
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
      const manufacturerIds = chunk.map((item) => item.manufacturer);
      console.log("distributorIds", manufacturerIds);
      const leadsSnap = await db
        .collection("leads")
        .where("leadId", "in", manufacturerIds)
        .get();

      console.log("leadsSnap", leadsSnap.docs.length);
      const leadsData = leadsSnap.docs.map((item) => {
        const lead = item.data();
        const allocatedItem = allocatedData.find(
          (allocated) => allocated.manufacturer === lead.leadId
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
      "userLeadId: here " + userLeadId,
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
      distributor_lastRemarks: remarks,
      distributor_disposition:disposition,
      distributor_subDisposition:subDisposition,
      lastUpdatedBy: userLeadId,
      lastUpdatedAt: Timestamp.now(),
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
    const { serviceDocId, distributor_readStatus } = req.body;

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
    if (!distributor_readStatus) {
      await db.collection("service").doc(serviceDocId).update({
        distributor_readStatus: "read",
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

router.post("/getLeads", checkAuth, getLeads);
router.post("/getAllocatedLeads", checkAuth, getAllocatedLeads);
router.post("/updateAllocatedLead", checkAuth, updateAllocatedLead);
router.post("/getAllUpdatesOfLead", checkAuth, getAllUpdatesOfLead);

module.exports = { distributor: router };
