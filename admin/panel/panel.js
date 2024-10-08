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

const saveImageLinkForLoginPage = async (req, res) => {
  try {
    const { imageLink } = req.body;
    if (!imageLink)
      return res
        .status(404)
        .send({ success: false, message: "No image link found!" });

    await db
      .collection("backend")
      .doc("images")
      .set({ loginBg: imageLink }, { merge: true });

    res
      .status(200)
      .send({ success: true, message: "Successfully saved image!" });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};

const getLoginPageImageLink = async (req, res) => {
  try {
    let dataSnpa = await db.collection("backend").doc("images").get();
    let data = dataSnpa.data();

    console.log("data is", data);
    res.status(200).send({ success: true, link: data?.loginBg || null });
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
router.post("/saveImageLinkForLoginPage", checkAuth, saveImageLinkForLoginPage);
router.get("/getLoginPageImageLink", getLoginPageImageLink);

module.exports = { panel: router };
