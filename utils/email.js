function generateOTP() {
  // Generate a random 4-digit number
  const otp = Math.floor(1000 + Math.random() * 9000);
  return otp;
}

const sendEmail = async ({ email, subject, text }) => {
  const mailjet = require("node-mailjet").apiConnect(
    process.env.MAIL_JET_API_KEY,
    process.env.MAIL_JET_SECRET
  );

  const request = await mailjet.post("send", { version: "v3.1" }).request({
    Messages: [
      {
        From: {
          Email: "shobhitsaini709@gmail.com",
          Name: "1Click Distribution",
        },
        To: [
          {
            Email: email,
          },
        ],
        Subject: subject,
        TextPart: text,
      },
    ],
  });

  const status = request.body.Messages[0].Status;
  if (status === "success") {
    return true;
  } else {
    return false;
  }
};

module.exports = { generateOTP, sendEmail };
