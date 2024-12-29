const express = require("express");
const { db } = require("../../config/firebase");
const { checkAuth } = require("../../middlewares/authMiddleware");
const moment = require("moment");
const { Timestamp, FieldValue } = require("firebase-admin/firestore");
const { getTeamMembersOfUser } = require("../../utils/utils");

const router = express.Router();

const getServiceLeads = async (req, res) => {
  try {
    const body = req.body;
    const startDate = moment(body.startDate, "YYYY-MM-DD")
      .startOf("day")
      .toDate();
    const endDate = moment(body.endDate, "YYYY-MM-DD").endOf("day").toDate();
    const myData = body.myData || null;

    let stampStart = Timestamp.fromDate(startDate).toDate();
    let stampEnd = Timestamp.fromDate(endDate).toDate();

    const userDepartment = req.department;
    const userRole = req.hierarchy;
    const userId = req.userId;

    console.log(userDepartment, userRole, userId);

    // getting all the internal user to filterout the member of the current user's team
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

    // filter the team members
    const getTeamMembers = await getTeamMembersOfUser(userId, allUsers);
    let allTeamMemberIds = [];
    let allLeads = [];

    // extract the ids of all the team members including user'
    if (
      (userDepartment === "Clients Service" && userRole === "Vice President") ||
      userRole === "superAdmin"
    ) {
      console.log("fetching all leads");
      // show all leads
      const leadSnap = await db
        .collection("leads")
        .where("disposition", "==", "Deal Done")
        .orderBy("updatedAt", "desc")
        .get();
      const leadsData = leadSnap.docs.map((doc) => doc.data());
      allLeads.push(...leadsData);
    } else {
      if (Array.isArray(getTeamMembers)) {
        allTeamMemberIds = getTeamMembers?.map((user) => user.id);
      }
      allTeamMemberIds.push(userId);

      for (let teamMemberId of allTeamMemberIds) {
        let snap = [];

        if (myData) {
          snap = await db
            .collection("leads")
            .where("serviceExecutive", "==", teamMemberId)
            .get();

          const leadsData = snap.docs.map((doc) => doc.data());
          allLeads.push(...leadsData);
        } else {
          snap = await db
            .collection("leads")
            .where("allocatedAt", ">=", stampStart)
            .where("allocatedAt", "<=", stampEnd)
            .where("serviceExecutive", "==", teamMemberId)
            .get();

          const assignedLeads = snap.docs.map((doc) => doc.data());

          allLeads.push(...assignedLeads);
        }
      }

      // filter leads
      allLeads = allLeads.reduce((acc, lead) => {
        if (!acc.find((item) => item.leadId === lead.leadId)) {
          acc.push(lead);
        }
        return acc;
      }, []);

      // here add the name of the sales executive and assigned by user's
      allLeads = allLeads.map((lead) => {
        if (lead?.salesExecutive) {
          lead.salesExecutiveName = allUsersByIds[lead.salesExecutive]?.name;
        }

        if (lead?.serviceExecutive) {
          lead.serviceExecutiveName =
            allUsersByIds[lead.serviceExecutive]?.name;
        }

        if (lead?.assignedBy) {
          lead.assignedBy = allTeamMemberIds[lead.assignedBy]?.name || null;
        }
        return lead;
      });
    }

    console.log("leads", allLeads.length);

    res.status(200).json({ success: true, leads: allLeads });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
};

router.post("/getServiceLeads", checkAuth, getServiceLeads);

module.exports = { serviceLeads: router };
