const { db } = require("../config/firebase");

const generateId = async (type) => {
  let id = null;
  if (type === "lead") {
    const leadCountSnap = await db.collection("backend").doc("leads").get();

    const count = leadCountSnap.data().leadCount
      ? leadCountSnap.data().leadCount + 1
      : 1;

    await db.collection("backend").doc("leads").update({
      leadCount: count,
    });
    id = count;
  } else if (type === "sales") {
    const salesCountSnap = await db.collection("backend").doc("sales").get();

    const count = salesCountSnap.data().salesCount
      ? salesCountSnap.data().salesCount + 1
      : 1;

    await db.collection("backend").doc("sales").update({
      salesCount: count,
    });
    id = count;
  }

  return id;
};

module.exports = {
  generateId,
};
