// You MUST host this file at the exact root of your domain.
// e.g., https://your-domain.com/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js');

// 1. Initialize the Firebase app in the service worker
// Replace these with your actual Firebase config values
firebase.initializeApp({
  apiKey: "AIzaSyDz4iG5KZy3JAxBhubaGEaMKTY7jcObRDE",
  authDomain: "deals-bcfea.firebaseapp.com",
  projectId: "deals-bcfea",
  storageBucket: "deals-bcfea.firebasestorage.app",
  messagingSenderId: "686014043249",
  appId: "1:686014043249:web:8dcc93549cdb265269b7d0"
});

// 2. Retrieve an instance of Firebase Messaging
const messaging = firebase.messaging();

// 3. Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message ', payload);
  
  const notificationTitle = payload.notification.title || 'WeightOps Update';
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png', // Ensure you have an icon here
    badge: '/icon-192x192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});