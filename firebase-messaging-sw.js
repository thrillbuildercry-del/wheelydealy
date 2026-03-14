// firebase-messaging-sw.js
importScripts('[https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js](https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js)');
importScripts('[https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js](https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js)');

// Initialize the Firebase app in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyDz4iG5KZy3JAxBhubaGEaMKTY7jcObRDE",
  authDomain: "deals-bcfea.firebaseapp.com",
  projectId: "deals-bcfea",
  storageBucket: "deals-bcfea.firebasestorage.app",
  messagingSenderId: "686014043249",
  appId: "1:686014043249:web:8dcc93549cdb265269b7d0"
});

const messaging = firebase.messaging();

// This handles the notification if the app is entirely closed/in the background
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon.png', // Add a 192x192 icon to your github repo!
    badge: '/icon.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});