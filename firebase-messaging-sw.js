importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');
firebase.initializeApp({
  apiKey: "AIzaSyDz4iG5KZy3JAxBhubaGEaMKTY7jcObRDE",
  authDomain: "deals-bcfea.firebaseapp.com",
  projectId: "deals-bcfea",
  storageBucket: "deals-bcfea.firebasestorage.app",
  messagingSenderId: "686014043249",
  appId: "1:686014043249:web:8dcc93549cdb265269b7d0"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log("Background message received:", payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/icon.png",
    badge: "/icon.png"
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
