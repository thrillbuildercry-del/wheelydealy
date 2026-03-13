// You MUST host this file at the exact root of your domain.
// e.g., https://your-domain.com/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDz4iG5KZy3JAxBhubaGEaMKTY7jcObRDE",
  authDomain: "deals-bcfea.firebaseapp.com",
  projectId: "deals-bcfea",
  storageBucket: "deals-bcfea.firebasestorage.app",
  messagingSenderId: "686014043249",
  appId: "1:686014043249:web:8dcc93549cdb265269b7d0"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'WeightOps Update';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new message or update.',
    icon: '/icon-192x192.png', // Ensure this file exists at your root
    badge: '/icon-192x192.png',
    vibrate: [200, 100, 200], // Vibration pattern
    requireInteraction: true, // Keeps it on screen until tapped
    data: {
      url: self.location.origin // Opens the app when tapped
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks (focuses app or opens it)
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) { client = clientList[i]; }
        }
        return client.focus();
      }
      return clients.openWindow(event.notification.data.url || '/');
    })
  );
});
