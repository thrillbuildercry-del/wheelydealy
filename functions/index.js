const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
admin.initializeApp();

exports.sendPushNotification = onDocumentCreated("artifacts/weight-tracker-v2/public/data/alerts/{alertId}", async (event) => {
  const snap = event.data;
  if (!snap) return;
  
  const alertData = snap.data();
  const targetUid = alertData.target; //
  const message = alertData.message;

  const userSettings = await admin.firestore()
    .doc(`artifacts/weight-tracker-v2/users/${targetUid}/settings/pushToken`)
    .get();

  if (!userSettings.exists) return;

  const token = userSettings.data().token;

  const payload = {
    notification: { title: "WeightOps Update", body: message },
    token: token,
  };

  try {
    await admin.messaging().send(payload);
  } catch (error) {
    console.error("Error sending message:", error);
  }
});