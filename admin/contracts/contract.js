const express = require("express");
const { Timestamp } = require("@google-cloud/firestore");
const moment = require("moment"); // Add this line
const router = express.Router();
const { db } = require("../../config/firebase");
const { generateId } = require("../../utils/utils");
const { checkAuth } = require("../../middlewares/authMiddleware");

const addContract = async (req, res) => {
  try {
    const body = req.body;

    const contractBody = {
      companyName: body.companyName,
      address: body.address,
      email: body.email,
      phone: body.phone,
      gstNumber: body.gstNumber,
      package: body.package,
      receivedAmount: body.receivedAmount,
    };

    const contractId = await generateId("contract");
    const contract = {
      contractId,
      ...body,
      createdAt: Timestamp.now(),
    };
    await db.collection("contracts").doc(contractId).set(contract);
    res.status(200).json({ message: "Contract added successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

router.post("/add-contract", checkAuth, addContract);
