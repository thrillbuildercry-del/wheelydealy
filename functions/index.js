const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
admin.initializeApp();

// Listen for new documents in the 'alerts' collection
exports.sendPushNotification = onDocumentCreated("artifacts/weight-tracker-v2/public/data/alerts/{alertId}", async (event) => {
  const snap = event.data;
  if (!snap) {
    return;
  }
  
  const alertData = snap.data();
  const targetUid = alertData.target; // The UID of the person receiving it
  const message = alertData.message;

  // 1. Get the target user's push token from Firestore
  const userSettings = await admin.firestore()
    .doc(`artifacts/weight-tracker-v2/users/${targetUid}/settings/pushToken`)
    .get();

  if (!userSettings.exists) {
    console.log(`No push token found for user ${targetUid}`);
    return;
  }

  const token = userSettings.data().token;

  // 2. Construct the Push Payload
  const payload = {
    notification: {
      title: "WeightOps Update",
      body: message,
    },
    token: token,
  };

  // 3. Send the physical push notification via FCM
  try {
    const response = await admin.messaging().send(payload);
    console.log("Successfully sent message:", response);
  } catch (error) {
    console.error("Error sending message:", error);
  }
});
