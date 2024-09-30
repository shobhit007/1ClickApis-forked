const express = require("express");
const { db } = require("../../config/firebase");
const { checkAuth } = require("../../middlewares/authMiddleware");
const router = express.Router();

const updateColumnsForSalesPanel = async (req, res) => {
  try {
    const { columns } = req.body;

    if (!columns || columns.length == 0) {
      return res
        .status(400)
        .send({ success: false, message: "Columns is required." });
    }

    await db
      .collection("data")
      .doc("salesPanelColumns")
      .set({ columns }, { merge: true });

    res.status(200).send({ success: true, message: "Columns updated." });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};

const getAllColumnsForSalesPanel = async (req, res) => {
  try {
    const snap = await db.collection("data").doc("salesPanelColumns").get();

    const data = snap.data().columns;
    res.status(200).send({ success: true, data });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};

router.post(
  "/updateColumnsForSalesPanel",
  checkAuth,
  updateColumnsForSalesPanel
);
router.get("/getAllColumnsForSalesPanel", getAllColumnsForSalesPanel);

module.exports = { panel: router };
