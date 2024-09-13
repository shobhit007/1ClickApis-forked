const firebase = require("firebase-admin");

const serviceAccount = require("../config/cred.json");

firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
});

const db = firebase.firestore();

module.exports = { db };
