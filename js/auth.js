<<<<<<< HEAD
import { auth, db, googleProvider, appId } from './firebase-config.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Online/Offline Tracker (1 Hour Timeout)
const trackPresence = () => {
    const events = ['mousedown', 'keydown', 'touchstart'];
    const updatePresence = () => {
        if (!window.currentUser) return;
        const now = Date.now();
        window.lastInteraction = now;
        
        // Only ping Firestore every 3 minutes max to save reads/writes
        if (!window.lastDbPing || now - window.lastDbPing > 180000) {
            window.lastDbPing = now;
            updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'roster', window.currentUser.uid), {
                lastActive: now,
                isOnline: true
            });
        }
    };
    events.forEach(e => window.addEventListener(e, updatePresence));

    // Auto Offline Check (Every minute)
    setInterval(() => {
        if(window.currentUser && window.lastInteraction) {
            if (Date.now() - window.lastInteraction > 3600000) { // 1 Hour
                updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'roster', window.currentUser.uid), { isOnline: false });
            }
        }
    }, 60000);
};
=======
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { auth, db, googleProvider, appId } from "./firebase-config.js";
import { state } from "./state.js";

// ---------------------------------------------------------
// AUTHENTICATION LOGIC
// ---------------------------------------------------------
>>>>>>> 943371159b2a0c16dfbdb9797471b19326c71169

window.handleGoogleLogin = async () => { 
    try { 
        const res = await signInWithPopup(auth, googleProvider);
        const profRef = doc(db, 'artifacts', appId, 'users', res.user.uid, 'settings', 'profile');
        const snap = await getDoc(profRef);
<<<<<<< HEAD
        if(!snap.exists()) {
            await setDoc(profRef, { name: res.user.displayName, email: res.user.email, role: 'staff', status: 'pending', createdAt: Date.now() });
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'roster', res.user.uid), { name: res.user.displayName, role: 'staff', status: 'pending', uid: res.user.uid, isOnline: true, lastActive: Date.now() }, {merge:true});
        }
    } catch (e) { 
        window.showToast("Login Failed: " + e.message); 
=======
        
        // If first time logging in, create their pending profile
        if(!snap.exists()) {
            await setDoc(profRef, { name: res.user.displayName, email: res.user.email, role: 'staff', status: 'pending', createdAt: Date.now() });
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'roster', res.user.uid), { name: res.user.displayName, role: 'staff', status: 'pending', uid: res.user.uid }, {merge:true});
        }
    } catch (e) { 
        if (window.showToast) window.showToast("Login Failed: " + e.message); 
>>>>>>> 943371159b2a0c16dfbdb9797471b19326c71169
    }
};

window.logout = async () => { 
<<<<<<< HEAD
    if(window.currentUser) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'roster', window.currentUser.uid), { isOnline: false });
    }
=======
    // Safely clear all active Firestore listeners
    Object.values(state.unsubs).forEach(unsub => {
        if (typeof unsub === 'function') unsub();
    });
    
    document.getElementById('staff-app').classList.add('hidden'); 
    document.getElementById('admin-app').classList.add('hidden'); 
    document.getElementById('approval-modal').classList.add('hidden');
    
>>>>>>> 943371159b2a0c16dfbdb9797471b19326c71169
    await signOut(auth); 
    window.location.reload(); 
};

<<<<<<< HEAD
onAuthStateChanged(auth, async (user) => {
    if (user) {
        window.currentUser = user;
        trackPresence();

        // Listen to Roster
        window.unsubRoster = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'roster'), (snap) => {
            window.globalRoster = [];
            snap.forEach(d => { window.globalRoster.push({ id: d.id, ...d.data() }); });
            if(window.userRole === 'admin' && typeof window.processAdminRosterUI === 'function') window.processAdminRosterUI();
            if(window.userRole === 'staff' && typeof window.updateStaffGlobalStats === 'function') window.updateStaffGlobalStats(); 
        });

        // Listen to Current User Status
        const rosterRef = doc(db, 'artifacts', appId, 'public', 'data', 'roster', user.uid);
        window.unsubAuthCheck = onSnapshot(rosterRef, (snap) => {
            const data = snap.data() || {};
            window.userRole = data.role || 'staff';
            const status = data.status || 'pending';
            
            window.currentUserName = data.name || user.displayName || 'User';
            const nameDisplay = document.getElementById('staff-name-display');
            if(nameDisplay) nameDisplay.innerText = window.currentUserName;

            document.getElementById('loading-overlay').classList.add('hidden');
            document.getElementById('login-modal').classList.add('hidden');

            if (window.userRole === 'admin') {
                document.getElementById('approval-modal').classList.add('hidden');
                document.getElementById('staff-app').classList.add('hidden');
                if(typeof window.initAdminDashboard === 'function') window.initAdminDashboard(user);
            } else if (status === 'active') {
                document.getElementById('approval-modal').classList.add('hidden');
                document.getElementById('admin-app').classList.add('hidden');
                if(typeof window.initStaffApp === 'function') window.initStaffApp(user);
            } else {
                document.getElementById('approval-modal').classList.remove('hidden'); 
                document.getElementById('staff-app').classList.add('hidden'); 
                document.getElementById('admin-app').classList.add('hidden');
                document.getElementById('approval-title').innerText = status === 'suspended' ? "Account Suspended" : "Access Pending"; 
                document.getElementById('approval-msg').innerText = status === 'suspended' ? "Your access has been restricted." : "Waiting for Admin approval.";
            }
        });
    } else {
        window.currentUser = null;
        document.getElementById('loading-overlay').classList.add('hidden');
        document.getElementById('login-modal').classList.remove('hidden');
    }
});
=======
// ---------------------------------------------------------
// AUTH STATE OBSERVER & ROLE ROUTING
// ---------------------------------------------------------

export function initAuth() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            state.currentUser = user;
            
            // 1. Listen to the user's specific roster document to determine permissions
            const rosterRef = doc(db, 'artifacts', appId, 'public', 'data', 'roster', user.uid);
            
            state.unsubs.authCheck = onSnapshot(rosterRef, (snap) => {
                const data = snap.data() || {};
                state.userRole = data.role || 'staff';
                const status = data.status || 'pending';
                
                window.currentUserName = data.name || user.displayName || 'User';
                const nameDisplay = document.getElementById('staff-name-display');
                if(nameDisplay) nameDisplay.innerText = window.currentUserName;

                // Hide loading/login modals
                const overlay = document.getElementById('loading-overlay');
                if(overlay) overlay.classList.add('hidden');
                const modal = document.getElementById('login-modal');
                if(modal) modal.classList.add('hidden');

                // Route the user based on their Role and Status
                if (state.userRole.includes('admin') || state.userRole.includes('manager')) {
                    document.getElementById('approval-modal').classList.add('hidden');
                    document.getElementById('staff-app').classList.add('hidden');
                    
                    // --- NEW: MANAGER RESTRICTIONS LOGIC ---
                    // Hide master features for department managers
                    if (state.userRole !== 'admin') {
                        document.querySelectorAll('.admin-only-feature').forEach(el => el.classList.add('hidden'));
                        
                        // Lock managers into their specific departments
                        if (state.userRole === 'manager_soft' && window.switchDept) window.switchDept('soft');
                        if (state.userRole === 'manager_hard' && window.switchDept) window.switchDept('hard');
                    } else {
                        // Master Admin sees everything
                        document.querySelectorAll('.admin-only-feature').forEach(el => el.classList.remove('hidden'));
                    }

                    // Fire up the Admin interface (defined in app.js)
                    if (window.initAdminDashboard) window.initAdminDashboard(user);
                    if (window.checkPushSetup) window.checkPushSetup();

                } else if (status === 'active') {
                    // Standard Staff
                    document.getElementById('approval-modal').classList.add('hidden');
                    document.getElementById('admin-app').classList.add('hidden');
                    
                    if (window.initStaffApp) window.initStaffApp(user);
                    if (window.checkPushSetup) window.checkPushSetup();

                } else {
                    // Pending or Suspended Users
                    document.getElementById('approval-modal').classList.remove('hidden'); 
                    document.getElementById('staff-app').classList.add('hidden'); 
                    document.getElementById('admin-app').classList.add('hidden');
                    
                    const title = document.getElementById('approval-title'); 
                    const msg = document.getElementById('approval-msg');
                    
                    if(status === 'suspended') { 
                        title.innerText = "Account Suspended"; 
                        msg.innerText = "Your access has been restricted by management."; 
                    } else { 
                        title.innerText = "Access Pending"; 
                        msg.innerText = "Waiting for Admin to approve your account."; 
                    }
                }
            }, (error) => { 
                const overlay = document.getElementById('loading-overlay');
                if(overlay) overlay.classList.add('hidden'); 
                if(window.showToast) window.showToast("Permission denied. Check Firebase Rules."); 
            });

            // 2. Attach global data listeners (Master Inventory, Chat, Requests, etc.)
            // We call this from window to avoid circular dependencies with app.js
            if (window.attachGlobalListeners) {
                window.attachGlobalListeners(user);
            }

        } else {
            // No user logged in
            state.currentUser = null;
            const overlay = document.getElementById('loading-overlay');
            if(overlay) overlay.classList.add('hidden');
            const loginModal = document.getElementById('login-modal');
            if(loginModal) loginModal.classList.remove('hidden');
        }
    });
}
>>>>>>> 943371159b2a0c16dfbdb9797471b19326c71169
