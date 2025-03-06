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

router.post("/getLeads", checkAuth, getLeads);

module.exports = { distributor: router };
