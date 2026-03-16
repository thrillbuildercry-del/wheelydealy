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

window.handleGoogleLogin = async () => { 
    try { 
        const res = await signInWithPopup(auth, googleProvider);
        const profRef = doc(db, 'artifacts', appId, 'users', res.user.uid, 'settings', 'profile');
        const snap = await getDoc(profRef);
        if(!snap.exists()) {
            await setDoc(profRef, { name: res.user.displayName, email: res.user.email, role: 'staff', status: 'pending', createdAt: Date.now() });
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'roster', res.user.uid), { name: res.user.displayName, role: 'staff', status: 'pending', uid: res.user.uid, isOnline: true, lastActive: Date.now() }, {merge:true});
        }
    } catch (e) { 
        window.showToast("Login Failed: " + e.message); 
    }
};

window.logout = async () => { 
    if(window.currentUser) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'roster', window.currentUser.uid), { isOnline: false });
    }
    await signOut(auth); 
    window.location.reload(); 
};

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