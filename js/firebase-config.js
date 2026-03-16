import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getMessaging } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js";

<<<<<<< HEAD
=======
// FIREBASE CONFIGURATION
>>>>>>> 943371159b2a0c16dfbdb9797471b19326c71169
const firebaseConfig = { 
    apiKey: "AIzaSyDz4iG5KZy3JAxBhubaGEaMKTY7jcObRDE", 
    authDomain: "deals-bcfea.firebaseapp.com", 
    projectId: "deals-bcfea", 
    storageBucket: "deals-bcfea.firebasestorage.app", 
    messagingSenderId: "686014043249", 
    appId: "1:686014043249:web:8dcc93549cdb265269b7d0" 
};

export const appId = "weight-tracker-v2"; 
export const app = initializeApp(firebaseConfig); 
export const auth = getAuth(app); 
export const db = getFirestore(app); 
export const googleProvider = new GoogleAuthProvider();

let messagingInstance = null;
try { 
    messagingInstance = getMessaging(app); 
} catch (e) { 
<<<<<<< HEAD
    console.warn("Push messaging not fully supported."); 
}
=======
    console.warn("Push messaging not fully supported in this environment."); 
}

>>>>>>> 943371159b2a0c16dfbdb9797471b19326c71169
export const messaging = messagingInstance;