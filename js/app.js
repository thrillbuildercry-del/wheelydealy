// Import and initialize all modules
import './firebase-config.js';
import './state.js';
import './auth.js';
import './staff.js';
import './admin.js';
import './social.js';

// Polyfill for incrementing Firestore arrays/numbers
import { increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
window.increment = increment;

document.addEventListener('DOMContentLoaded', () => {
    if(typeof lucide !== 'undefined') lucide.createIcons();
});