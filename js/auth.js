import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { auth, db, provider, appId } from "./firebase-config.js";
import { state } from "./state.js";
import { initData } from "./app.js";

window.handleGoogleLogin = async () => { 
    try { 
        const res = await signInWithPopup(auth, provider);
        const p = await getDoc(doc(db,'artifacts',appId,'users',res.user.uid,'settings','profile'));
        if(!p.exists()) {
            await setDoc(doc(db,'artifacts',appId,'users',res.user.uid,'settings','profile'), {name:res.user.displayName, role:'staff', status:'pending'});
            await setDoc(doc(db,'artifacts',appId,'public','data','roster',res.user.uid), {name:res.user.displayName, role:'staff', status:'pending'}, {merge:true});
        }
    } catch(e) { window.showToast(e.message); }
};

window.logout = async () => { 
    Object.values(state.unsubs).forEach(u => u && u()); 
    await signOut(auth); 
    location.reload(); 
};

onAuthStateChanged(auth, user => {
    if(user) {
        state.user = user;
        document.getElementById('loading-overlay').classList.add('hidden');
        document.getElementById('login-modal').classList.add('hidden');
        
        state.unsubs.auth = onSnapshot(doc(db,'artifacts',appId,'public','data','roster',user.uid), snap => {
            const data = snap.data() || {};
            state.role = data.role || 'staff';
            const status = data.status || 'pending';
            
            document.getElementById('top-user-name').innerText = data.name || user.displayName;
            document.getElementById('user-avatar-initial').innerText = (data.name || user.displayName || 'U')[0].toUpperCase();
            document.getElementById('prof-name').innerText = data.name || user.displayName;
            document.getElementById('prof-avatar').innerText = (data.name || user.displayName || 'U')[0].toUpperCase();
            
            let roleStr = "Staff";
            if(state.role==='admin') { 
                roleStr="Master Admin"; 
                document.querySelectorAll('.admin-only').forEach(el=>el.classList.remove('hidden')); 
            } else if(state.role==='manager_soft') { 
                roleStr="Soft Dept Manager"; 
                state.dept='soft'; 
                document.querySelectorAll('.admin-only').forEach(el=>el.classList.remove('hidden')); 
                document.getElementById('dept-hard').classList.add('hidden');
            } else if(state.role==='manager_hard') { 
                roleStr="Hard Dept Manager"; 
                state.dept='hard'; 
                document.querySelectorAll('.admin-only').forEach(el=>el.classList.remove('hidden')); 
                document.getElementById('dept-soft').classList.add('hidden');
            }
            document.getElementById('prof-role').innerText = roleStr;

            if(state.role.includes('admin') || state.role.includes('manager')) {
                document.getElementById('approval-modal').classList.add('hidden');
                document.getElementById('main-app').classList.remove('hidden');
                initData(user.uid);
            } else if (status === 'active') {
                document.getElementById('approval-modal').classList.add('hidden');
                document.getElementById('main-app').classList.remove('hidden');
                initData(user.uid);
            } else {
                document.getElementById('approval-modal').classList.remove('hidden');
            }
        });
    } else {
        document.getElementById('loading-overlay').classList.add('hidden');
        document.getElementById('login-modal').classList.remove('hidden');
    }
});