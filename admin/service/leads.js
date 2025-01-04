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

/**
 {
      label: "Welcome calls",
      value: "welcome_calls",
    },
    {
      label: "My allocations",
      value: "my_allocations",
    },
    {
      label: "Distributor Onboarding",
      value: "distributor_onboarding",
    },
    {
      label: "Live Distributor",
      value: "live_distributor",
    },
 */

const getLeadsForService = async (req, res) => {
  try {
    const body = req.body;
    console.log("body", body);
    const value = body.value;
    const startDate = moment(body.startDate).startOf("day").toDate();
    const endDate = moment(body.endDate).endOf("day").toDate();

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

    // filter the team members
    const getTeamMembers = await getTeamMembersOfUser(userId, allUsers);
    let allTeamMemberIds = [];
    let allLeads = [];

    let leads;

    if (value === "welcome_calls") {
      if (
        userRole === "superAdmin" ||
        (userDepartment === "Clients Service" && userRole === "Vice President")
      ) {
        const snapshot = await db
          .collection("leads")
          .where("welcomeCall", "==", false)
          .orderBy("updatedAt", "desc")
          .get();

        leads = snapshot.docs.map((doc) => doc.data());
        allLeads.push(...leads);
      } else {
        if (Array.isArray(getTeamMembers)) {
          allTeamMemberIds = getTeamMembers?.map((user) => user.id);
        }
        allTeamMemberIds.push(userId);

        for (let teamMemberId of allTeamMemberIds) {
          const snapshot = await db
            .collection("leads")
            .where("serviceExecutive", "==", teamMemberId)
            .where("welcomeCall", "==", false)
            .orderBy("updatedAt", "desc")
            .get();

          leads = snapshot.docs.map((doc) => doc.data());
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
          .where("disposition", "==", "Deal Done")
          .orderBy("updatedAt", "desc")
          .get();

        leads = snapshot.docs.map((doc) => doc.data());
        allLeads.push(...leads);
      } else {
        console.log("here2");
        if (Array.isArray(getTeamMembers)) {
          allTeamMemberIds = getTeamMembers?.map((user) => user.id);
        }
        allTeamMemberIds.push(userId);

        for (let teamMemberId of allTeamMemberIds) {
          const snapshot = await db
            .collection("leads")
            .where("serviceExecutive", "==", teamMemberId)
            .orderBy("updatedAt", "desc")
            .get();

          leads = snapshot.docs.map((doc) => doc.data());
          allLeads.push(...leads);
        }
        console.log("allLeads", allLeads.length);
      }
    } else if (value === "distributor_onboarding") {
      const snapshot = await db
        .collection("leads")
        .where("serviceExecutive", "==", userId)
        .where("disposition", "==", "Distributor Onboarding")
        .orderBy("updatedAt", "desc")
        .get();

      leads = snapshot.docs.map((doc) => doc.data());
    } else if (value === "live_distributor") {
      const snapshot = await db
        .collection("leads")
        .where("serviceExecutive", "==", userId)
        .where("disposition", "==", "Live Distributor")
        .orderBy("updatedAt", "desc")
        .get();

      leads = snapshot.docs.map((doc) => doc.data());
    }

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
        lead.serviceExecutiveName = allUsersByIds[lead.serviceExecutive]?.name;
      }

      if (lead?.assignedServiceLeadBy) {
        lead.assignedServiceLeadBy =
          allUsersByIds[lead.assignedServiceLeadBy]?.name || null;
      }
      return lead;
    });

    res.status(200).json({ success: true, leads: allLeads });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message, success: false });
  }
};

const getWelcomeCalls = async (req, res) => {
  try {
    const userId = req.userId;

    const snapshot = await db
      .collection("leads")
      .where("serviceExecutive", "==", userId)
      .where("welcomeCall", "==", false)
      .orderBy("updatedAt", "desc")
      .get();

    const leads = snapshot.docs.map((doc) => doc.data());
    res.status(200).json({ success: true, leads: leads });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
};

// Get all allocated service data of a service executive
const getMyServiceData = async (req, res) => {
  try {
    const userId = req.userId;

    const snapshot = await db
      .collection("leads")
      .where("serviceExecutive", "==", userId)
      .orderBy("updatedAt", "desc")
      .get();

    const leads = snapshot.docs.map((doc) => doc.data());
    res.status(200).json({ success: true, leads: leads });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
};

const getServiceMembers = async (req, res) => {
  try {
    const salesDeptMembersSnap = await db
      .collection("users")
      .doc("internal_users")
      .collection("credentials")
      .where("department", "==", "Clients Service")
      .get();

    let users = salesDeptMembersSnap.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));

    users = users.filter((item) => item.isActive);

    const userMap = {};

    users.forEach((user) => {
      userMap[user.id] = { ...user, teamMembers: [] };
    });

    let result = [];
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
      if (
        (!user?.senior || user?.seniour == "") &&
        userMap[user.id].teamMembers.length === 0
      ) {
        orphans.push(userMap[user.id]);
      }
    });

    result = result.filter((item) => {
      let found = orphans.find((i) => i.id == item.id);

      return !found;
    });

    let finalData = [...result, ...orphans];

    res.status(200).send({ success: true, data: finalData });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};

const allocateServiceLeads = async (req, res) => {
  try {
    const leads = req.body.leads;
    const serviceExecutive = req.body.serviceExecutive;
    const batch = db.batch();

    for (let lead of leads) {
      const leadRef = db.collection("leads").doc(`1click${lead}`);
      batch.update(leadRef, {
        serviceExecutive: serviceExecutive,
        allocatedServiceLeadAt: Timestamp.now(),
        assignedServiceLeadBy: req.userId,
        welcomeCall: false,
      });
    }

    await batch.commit();

    res
      .status(200)
      .send({ success: true, message: "Leads allocated successfully" });
  } catch (error) {
    res.status(500).send({ message: error.message, success: false });
  }
};

router.post("/getServiceLeads", checkAuth, getServiceLeads);
router.post("/getWelcomeCalls", checkAuth, getWelcomeCalls);
router.post("/getMyServiceData", checkAuth, getMyServiceData);
router.post("/getLeadsForService", checkAuth, getLeadsForService);
router.get("/getServiceMembers", checkAuth, getServiceMembers);
router.post("/allocateServiceLeads", checkAuth, allocateServiceLeads);

module.exports = { serviceLeads: router };
