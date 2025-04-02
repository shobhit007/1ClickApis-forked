const express = require("express");
const { db, storage } = require("../../config/firebase");
const { checkAuth } = require("../../middlewares/authMiddleware");
const moment = require("moment");
const { Timestamp, FieldValue } = require("firebase-admin/firestore");
const {
  getTeamMembersOfUser,
  generateId,
  generateSerialNumber,
} = require("../../utils/utils");
const multer = require("multer");
const { createServiceUser } = require("../auth/auth");

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

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

// currently using api
const getLeadsForService = async (req, res) => {
  try {
    const body = req.body;
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
          .where("disposition", "==", "Deal Done")
          .where("welcomeCall", "==", false)
          // .orderBy("updatedAt", "desc")
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
            .where("disposition", "==", "Deal Done")
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
          .where("welcomeCall", "==", true)
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
            .where("disposition", "==", "Deal Done")
            .where("welcomeCall", "==", true)
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

const updateWelcomeCall = async (req, res) => {
  try {
    const data = req.body.data;
    const leadId = data.leadId;

    await db
      .collection("leads")
      .doc(`1click${leadId}`)
      .update({ ...data });

    res.status(200).json({ message: "Form submitted successfully!" });
  } catch (error) {
    console.error("Error submitting form:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const addWwelcomeCallRemarks = async (req, res) => {
  try {
    const leadId = req.body.leadId;
    const userId = req.userId;
    const disposition = req.body.disposition;
    const remark = req.body.remark;
    const userType = req.body.userType;

    const remarkBody = {
      remark,
      createdAt: Timestamp.now(),
      createdBy: userId,
      disposition,
    };

    const leadRef = db.collection("leads").doc(`1click${leadId}`);

    // mark as live
    if (disposition === "complete_details") {
      leadRef.update({
        startServiceAt: Timestamp.now(),
        welcomeCall: true,
        updatedAt: Timestamp.now(),
      });

      const snapshot = await leadRef.get();
      const leadsData = snapshot.data();

      const credentials = {
        email: leadsData.email,
        password: "1234",
        userLeadId: leadsData.leadId,
        name: leadsData.full_name,
        phone: leadsData.phone_number,
        userType: leadsData?.leadType || "",
      };

      const response = await createServiceUser(credentials);
    }

    await leadRef
      .collection("welcomeCall")
      .doc("welcomeCall")
      .collection("remarks")
      .add(remarkBody);

    res
      .status(200)
      .send({ success: true, message: "Remark added successfully!" });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
};

const uploadServiceProduct = async (req, res) => {
  try {
    const leadId = req.body.leadId;
    const product = req.body.product;
    const leadRef = db.collection("leads").doc(`1click${leadId}`);

    await leadRef
      .collection("welcomeCall")
      .doc("welcomeCall")
      .collection("products")
      .add(product);

    res.status(200).json({ message: "Product added successfully!" });
  } catch (error) {
    console.error("Error submitting form:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const deleteServiceProduct = async (req, res) => {
  try {
    const leadId = req.body.leadId;
    const productId = req.body.productId;
    const leadRef = db.collection("leads").doc(`1click${leadId}`);

    await leadRef
      .collection("welcomeCall")
      .doc("welcomeCall")
      .collection("products")
      .doc(productId)
      .delete();

    res.status(200).json({ message: "Product deleted successfully!" });
  } catch (error) {
    console.error("Error submitting form:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getWelcomeCallData = async (req, res) => {
  try {
    const leadId = req.body.leadId;
    const leadRef = db.collection("leads").doc(`1click${leadId}`);
    const snapshot = await leadRef
      .collection("welcomeCall")
      .doc("welcomeCall")
      .get();

    let allData = { products: [], remarks: [], welcomeCallData: null };
    const data = snapshot.data();

    if (data) {
      allData.welcomeCallData = data;
    }

    const products = await leadRef
      .collection("welcomeCall")
      .doc("welcomeCall")
      .collection("products")
      .get();
    allData.products =
      products.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      })) || [];

    // add remarks
    const remarkSnap = await leadRef
      .collection("welcomeCall")
      .doc("welcomeCall")
      .collection("remarks")
      .orderBy("createdAt", "desc")
      .get();
    const remarks = remarkSnap.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    }));

    allData.remarks = remarks || [];

    res.status(200).json({ success: true, data: allData });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
};

const updateServiceLead = async (req, res) => {
  try {
    const body = req.body;
    const leadId = body.leadId;
    const followUpDate = body.followUpDate
      ? Timestamp.fromDate(moment(body.followUpDate).toDate())
      : null;
    body.followUpDate = followUpDate;
    delete body.leadId;

    const leadRef = db.collection("leads").doc(`1click${leadId}`);
    const historyRef = db
      .collection("leads")
      .doc(`1click${leadId}`)
      .collection("serviceHistory");

    const historySnap = await historyRef
      .orderBy("updatedAt", "desc")
      .limit(1)
      .get();
    let serviceDataTag = "NA";
    if (!historySnap.empty) {
      serviceDataTag = historySnap.docs[0].data().disposition || "NA";
    }

    const updatedData = {
      serviceDisposition: body.disposition,
      serviceSubDisposition: body.subDisposition,
      serviceRemarks: body.remarks,
      serviceFollowUpDate: body.followUpDate,
      serviceUpdatedAt: Timestamp.now(),
      serviceDataTag,
    };

    await leadRef.update(updatedData);
    await historyRef.doc().set({
      ...body,
      updatedAt: Timestamp.now(),
      updatedBy: req.userId,
      hierarchy: req.hierarchy,
      type: "service",
    });

    res
      .status(200)
      .json({ success: true, message: "Lead updated successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message, success: false });
  }
};

const assignDistributorOrManufacturer = async (req, res) => {
  try {
    console.log(req.body);
    const { manufacturerId, type, distributorId } = req.body;
    const user = req.decoded;

    const serviceId = await generateId("service");
    const serialId = generateSerialNumber(serviceId);

    const serviceData = {
      manufacturer: manufacturerId,
      distributor: distributorId,
      assignedAt: Timestamp.now(),
      assignedBy: user.userId,
    };

    await db.collection("service").doc(serialId).set(serviceData);

    res.status(200).json({
      message: `Assigned successfully!`,
      success: true,
    });
  } catch (error) {
    console.error("Error assigning distributor or manufacturer:", error);
    res.status(500).json({ message: error.message, success: false });
  }
};

const removeDistributorOrManufacturer = async (req, res) => {
  try {
    console.log(req.body);
    const { type, serviceId } = req.body;
    const user = req.decoded;

    const serviceRef = db.collection("service").doc(serviceId);

    const snapshot = await serviceRef.get();
    const serviceData = snapshot.data();
    const distributor = serviceData.distributor;
    const manufacturer = serviceData.manufacturer;

    serviceData.manufacturer = null;
    serviceData.distributor = null;
    serviceData.members = [distributor, manufacturer];
    serviceData.unassignedAt = Timestamp.now();
    serviceData.unassignedBy = user.userId;

    await serviceRef.update(serviceData);

    res.status(200).json({
      message: `Unassigned successfully!`,
      success: true,
    });
  } catch (error) {
    console.error("Error removing distributor or manufacturer:", error);
    res.status(500).json({ message: error.message, success: false });
  }
};

const getDistributorsOrManufacturers = async (req, res) => {
  try {
    const type = req.body.type;
    const leadId = req.body.leadId;

    // Determine the collection based on the type
    const memberType = type === "distributor" ? "manufacturer" : "distributor";

    let snapshot = await db
      .collection("leads")
      .where("leadType", "==", memberType)
      .get();

    let data = snapshot.docs.map((item) => ({ ...item.data() }));

    // assgined members
    const assignedSnapshot = await db
      .collection("service")
      .where(type, "==", leadId)
      .get();

    const assignedData = assignedSnapshot.docs
      .map((item) => ({ ...item.data() }))
      .reduce((acc, curr) => {
        acc[curr[memberType]] = curr;
        return acc;
      }, {});

    // filter assigned members
    data = data.filter((item) => {
      return !assignedData[item.leadId];
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching distributors or manufacturers:", error);
    res.status(500).json({ message: error.message, success: false });
  }
};

const getAssignedDistributorsOrManufacturers = async (req, res) => {
  try {
    const leadId = req.body.leadId;
    const type = req.body.type;

    // Determine the collection based on the type
    const memberType = type === "distributor" ? "manufacturer" : "distributor";

    const snapshot = await db
      .collection("service")
      .where(type, "==", leadId)
      .get();
    const data = snapshot.docs.map((item) => ({ ...item.data(), id: item.id }));

    const serviceIdByLeads = data.reduce((acc, curr) => {
      acc[curr[memberType]] = curr.id;
      return acc;
    }, {});

    const leadIds = data.map((item) => item[memberType]);

    const chunks = [];
    for (let i = 0; i < leadIds.length; i += 30) {
      chunks.push(leadIds.slice(i, i + 30));
    }

    let finalData = [];
    const leadsPromise = chunks.map((chunk) =>
      db.collection("leads").where("leadId", "in", chunk).get()
    );
    const snapshots = await Promise.all(leadsPromise);
    snapshots.forEach((snapshot) => {
      finalData.push(...snapshot.docs.map((doc) => doc.data()));
    });

    finalData = finalData.map((item) => {
      item.serviceId = serviceIdByLeads[item.leadId];
      return item;
    });

    res.status(200).json({ success: true, data: finalData });
  } catch (error) {
    console.error("Error fetching distributors or manufacturers:", error);
    res.status(500).json({ message: error.message, success: false });
  }
};

const searchDistributorsOrManufacturers = async (req, res) => {
  try {
    const body = req.body;
    const searchQuery = body.searchQuery;
    const searchField = body.searchField;

    const snapshot = await db
      .collection("leads")
      .where(searchField, "==", searchQuery)
      .get();

    const data = snapshot.docs.map((item) => ({ ...item.data() }));

    res.status(200).send({ success: true, data });
  } catch (error) {
    res.status(500).send({ message: error.message, success: false });
  }
};

const addProductCategory = async (req, res) => {
  try {
    const { category } = req.body;

    await db
      .collection("data")
      .doc("categories")
      .set({ categories: FieldValue.arrayUnion(category) }, { merge: true });

    res.status(200).json({ message: "Category added successfully!" });
  } catch (error) {
    console.error("Error submitting form:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const addProductSubCategory = async (req, res) => {
  try {
    console.log(req.body);
    const { category, subCategory } = req.body;

    const ref = db.collection("data").doc("subCategories");
    const snapshot = await ref.get();
    const data = snapshot.data();
    const subCategories = data?.subCategories || {};
    const subCategoriesList = subCategories[category] || [];
    subCategoriesList.push(subCategory);
    subCategories[category] = subCategoriesList;
    console.log(subCategories);
    await ref.set({ subCategories }, { merge: true });

    res.status(200).json({ message: "Sub category added successfully!" });
  } catch (error) {
    console.error("Error submitting form:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const removeProductCategory = async (req, res) => {
  try {
    const { category } = req.body;

    await db
      .collection("data")
      .doc("categories")
      .set({ categories: FieldValue.arrayRemove(category) }, { merge: true });

    res.status(200).json({ message: "Category removed successfully!" });
  } catch (error) {
    console.error("Error removing category:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const removeProductSubCategory = async (req, res) => {
  try {
    const { category, subCategory } = req.body;

    const ref = db.collection("data").doc("subCategories");
    const snapshot = await ref.get();
    const data = snapshot.data();
    const subCategories = data?.subCategories || {};
    const subCategoriesList = subCategories[category] || [];
    const index = subCategoriesList.indexOf(subCategory);
    if (index > -1) {
      subCategoriesList.splice(index, 1);
    }
    subCategories[category] = subCategoriesList;
    await ref.set({ subCategories }, { merge: true });

    res.status(200).json({ message: "Sub category removed successfully!" });
  } catch (error) {
    console.error("Error removing sub category:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getCategoriesAndSubCategories = async (req, res) => {
  try {
    const categoriesSnap = await db.collection("data").doc("categories").get();
    const subCategoriesSnap = await db
      .collection("data")
      .doc("subCategories")
      .get();

    const categories = categoriesSnap.data()?.categories || [];
    const subCategories = subCategoriesSnap.data()?.subCategories || {};

    res.status(200).json({ success: true, categories, subCategories });
  } catch (error) {
    console.error("Error submitting form:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

router.post("/getWelcomeCallData", checkAuth, getWelcomeCallData);
router.post("/updateWelcomeCall", updateWelcomeCall);
router.post("/getServiceLeads", checkAuth, getServiceLeads);
router.post("/getLeadsForService", checkAuth, getLeadsForService);
router.get("/getServiceMembers", checkAuth, getServiceMembers);
router.post("/allocateServiceLeads", checkAuth, allocateServiceLeads);
router.post("/uploadServiceProduct", checkAuth, uploadServiceProduct);
router.post("/deleteServiceProduct", checkAuth, deleteServiceProduct);
router.post("/addWwelcomeCallRemarks", checkAuth, addWwelcomeCallRemarks);
router.post("/updateServiceLead", checkAuth, updateServiceLead);
router.post(
  "/getDistributorsOrManufacturers",
  checkAuth,
  getDistributorsOrManufacturers
);
router.post(
  "/assignDistributorOrManufacturer",
  checkAuth,
  assignDistributorOrManufacturer
);
router.post(
  "/removeDistributorOrManufacturer",
  checkAuth,
  removeDistributorOrManufacturer
);
router.post(
  "/getAssignedDistributorsOrManufacturers",
  checkAuth,
  getAssignedDistributorsOrManufacturers
);
router.post(
  "/searchDistributorsOrManufacturers",
  checkAuth,
  searchDistributorsOrManufacturers
);
router.post("/addProductCategory", checkAuth, addProductCategory);
router.post("/addProductSubCategory", checkAuth, addProductSubCategory);
router.post("/removeProductCategory", checkAuth, removeProductCategory);
router.post("/removeProductSubCategory", checkAuth, removeProductSubCategory);
router.get(
  "/getCategoriesAndSubCategories",
  checkAuth,
  getCategoriesAndSubCategories
);

module.exports = { serviceLeads: router };
