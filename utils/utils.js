const { db } = require("../config/firebase");

const generateId = async (type) => {
  let id = null;
  if (type === "lead") {
    const leadCountSnap = await db.collection("backend").doc("leads").get();

    const count = leadCountSnap?.data()?.leadsCount
      ? leadCountSnap?.data()?.leadsCount + 1
      : 1;

    await db.collection("backend").doc("leads").set(
      {
        leadsCount: count,
      },
      { merge: true }
    );
    id = count;
  } else if (type === "sales") {
    const salesCountSnap = await db.collection("backend").doc("sales").get();
    const count = salesCountSnap?.data()?.salesMembersCount
      ? salesCountSnap?.data()?.salesMembersCount + 1
      : 1;

    await db.collection("backend").doc("sales").set(
      {
        salesMembersCount: count,
      },
      { merge: true }
    );
    id = count;
  } else if (type === "contract") {
    const contractCountSnap = await db
      .collection("backend")
      .doc("contracts")
      .get();
    const count = contractCountSnap?.data()?.contractsCount
      ? contractCountSnap?.data()?.contractsCount + 1
      : 1;

    await db.collection("backend").doc("contracts").set(
      {
        contractsCount: count,
      },
      { merge: true }
    );
    id = count;
  } else if (type == "internal_user") {
    const internalUserSnap = await db
      .collection("backend")
      .doc("internalUser")
      .get();
    const count = internalUserSnap?.data()?.internalMembersCount
      ? internalUserSnap?.data()?.internalMembersCount + 1
      : 1;

    await db.collection("backend").doc("internalUser").set(
      {
        internalMembersCount: count,
      },
      { merge: true }
    );
    id = count;
  }

  return id;
};

module.exports = {
  generateId,
};
