<<<<<<< HEAD
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
=======
import { doc, getDoc, setDoc, onSnapshot, collection, query, orderBy, limit, addDoc, deleteDoc, increment, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js";
import { db, appId, messaging } from "./firebase-config.js";
import { state } from "./state.js";
import { initAuth } from "./auth.js";
import "./admin-tools.js";
import "./staff-tools.js";
import "./social.js";
// ============================================================================
// UTILITY & HELPER FUNCTIONS
// ============================================================================

window.showToast = (msg) => { 
    const t = document.getElementById('toast'); 
    t.innerText = msg; 
    t.className = "show"; 
    setTimeout(() => t.className = "", 3000); 
};

window.toggleTheme = () => { 
    document.documentElement.classList.toggle('dark'); 
    localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light'); 
};

window.animateValue = (id, start, end, duration, prefix = '', isCurrency = false) => {
    if (start === end) return;
    const obj = document.getElementById(id);
    if(!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const currentVal = progress * (end - start) + start;
        
        if(isCurrency) {
            obj.innerText = `${prefix}${currentVal.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
        } else {
            obj.innerText = `${prefix}${currentVal.toFixed(1)}`;
        }
        
        if (progress < 1) window.requestAnimationFrame(step);
        else {
            if(isCurrency) obj.innerText = `${prefix}${end.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
            else obj.innerText = `${prefix}${end.toFixed(1)}`;
        }
    };
    window.requestAnimationFrame(step);
};

const playPingSound = () => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); 
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
    } catch(e) {}
};

// --- DYNAMIC DEPARTMENT HELPERS ---
// These allow us to seamlessly switch between SOFT and HARD inventory variables
const getMF = (base) => `${base}_${state.currentDept}`; // Master Field
const getAF = (base) => `${base}_${state.currentDept}`; // App (Staff/Admin) Field

// ============================================================================
// GLOBAL LISTENERS (Attached after login)
// ============================================================================

window.attachGlobalListeners = (user) => {
    // 1. Roster Listener
    state.unsubs.roster = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'roster'), (snap) => {
        state.globalRoster = [];
        snap.forEach(d => { state.globalRoster.push({ id: d.id, ...d.data() }); });
        
        if(state.userRole.includes('admin') || state.userRole.includes('manager')) {
            window.processAdminRosterUI();
            if(!document.getElementById('admin-view-finance').classList.contains('hidden')) {
                window.loadGlobalAnalytics();
            }
        }
        if(state.userRole === 'staff') window.updateStaffGlobalStats(); 
    }, (e) => console.warn("Roster sync error:", e));

    // 2. Master Inventory Listener
    state.unsubs.master = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'inventory', 'master'), (s) => {
        if(s.exists()) {
            const dat = s.data();
            let oldCash = state.masterData.cashBalance || 0;
            let oldRaw = state.masterData[getMF('rawWeight')] || 0;

            state.masterData = { 
                ...state.masterData,
                adminDiscount: dat.adminDiscount ?? 20, 
                staffDiscount: dat.staffDiscount ?? 20, 
                ...dat 
            };
            
            window.updateMasterLabels();
            
            if (state.userRole === 'staff') {
                const annBanner = document.getElementById('staff-announcement');
                const annText = document.getElementById('staff-announcement-text');
                if(annBanner && annText) {
                    if (state.masterData.announcement && state.masterData.announcement.trim() !== '') {
                        annText.innerText = state.masterData.announcement;
                        annBanner.classList.remove('hidden');
                    } else {
                        annBanner.classList.add('hidden');
                    }
                }
            }

            if(state.userRole.includes('admin') || state.userRole.includes('manager')) { 
                window.admUpdateMasterLabels(); 
                window.animateValue('finance-cash-balance', oldCash, state.masterData.cashBalance, 600, '$', true);
                window.animateValue('admin-master-weight', oldRaw, state.masterData[getMF('rawWeight')], 400, '', false);
                window.updateFinanceUI(); 
                window.updateIOUUI();
            }
        }
    }, (e) => console.warn("Master sync error:", e));

    // 3. Requests Listener
    state.unsubs.reqs = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'requests'), orderBy('timestamp', 'desc')), (snap) => {
        const reqList = document.getElementById('admin-requests-list');
        const reqSect = document.getElementById('admin-requests-section');
        const badge = document.getElementById('admin-req-badge');
        
        if(!reqList) return;
        reqList.innerHTML = '';
        let activeReqs = 0;
        
        snap.forEach(docSnap => {
            const req = docSnap.data();
            if(req.status === 'pending') {
                activeReqs++;
                let actionHtml = '';
                if(req.type === 'bill' || req.type === 'bill_request') {
                    actionHtml = `<div class="text-xs text-gray-800 dark:text-white mt-1">Needs Bill for: <span class="font-bold">${req.desc}</span> ($${req.amount})</div>`;
                } else if (req.type === 'iou' || req.type === 'iou_request') {
                    actionHtml = `<div class="text-xs text-gray-800 dark:text-white mt-1">Client IOU: <span class="font-bold">${req.clientName}</span> - ${req.qty} ${req.iouType} ($${req.amount})</div>`;
                } else if (req.type === 'inventory' || req.type === 'weight') {
                    actionHtml = `<div class="text-xs text-gray-800 dark:text-white mt-1">Requested Resupply.</div>`;
                }

                reqList.innerHTML += `
                    <div class="bg-white dark:bg-gray-800 p-3 rounded-xl border border-blue-100 dark:border-gray-700 shadow-sm">
                        <div class="flex justify-between items-center mb-1">
                            <span class="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">${req.name || req.staffName} • ${new Date(req.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            <span class="text-[9px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded uppercase font-bold">${req.type.replace('_request', '')}</span>
                        </div>
                        ${actionHtml}
                        <div class="flex space-x-2 mt-3">
                            <button onclick="window.adminHandleRequest('${docSnap.id}', 'approve', '${req.type}')" class="flex-1 bg-green-500 text-white text-xs font-bold py-2 rounded-lg hover:bg-green-600 transition btn-interactive">Approve</button>
                            <button onclick="window.adminHandleRequest('${docSnap.id}', 'deny', '${req.type}')" class="flex-1 bg-red-100 text-red-600 text-xs font-bold py-2 rounded-lg hover:bg-red-200 transition btn-interactive">Dismiss</button>
                        </div>
                    </div>`;
            }
        });

        if(activeReqs > 0) {
            reqSect.classList.remove('hidden');
            if(badge) badge.classList.remove('hidden');
        } else {
            reqSect.classList.add('hidden');
            if(badge) badge.classList.add('hidden');
        }
    }, (e) => console.warn("Requests sync error:", e));

    // 4. Contacts & Chat
    state.unsubs.contacts = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'contacts'), (snap) => {
        state.globalContacts = [];
        snap.forEach(d => state.globalContacts.push({id: d.id, ...d.data()}));
        window.filterContacts();
    });

    state.unsubs.chat = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'chat'), orderBy('timestamp', 'desc'), limit(50)), (snap) => {
        const newMessages = [];
        snap.forEach(d => newMessages.unshift({id: d.id, ...d.data()}));
        state.chatMessages = newMessages;
        
        if (document.getElementById('chat-modal').classList.contains('hidden') && state.chatMessages.length > 0) {
            const lastMsg = state.chatMessages[state.chatMessages.length - 1];
            if (lastMsg.senderId !== user.uid && lastMsg.uid !== user.uid) {
                const badge = state.userRole.includes('admin') || state.userRole.includes('manager') ? document.getElementById('admin-chat-badge') : document.getElementById('staff-chat-badge');
                if(badge) badge.classList.remove('hidden');
                state.chatUnreadCount++;
                if(state.chatUnreadCount === 1) playPingSound();
            }
        }
        window.renderChatMessages();
    });
};

// ============================================================================
// CORE INITIALIZATION & TAB SWITCHING
// ============================================================================

window.initAdminDashboard = (user) => {
    document.getElementById('admin-app').classList.remove('hidden');
    window.switchAdminTab('storage');
    
    state.unsubs.userData = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'app_state'), (snap) => {
        if(snap.exists()) {
            const d = JSON.parse(snap.data().json);
            state.adminData = { ...state.adminData, ...d };
            window.admUpdateMasterLabels();
            window.renderAdminTerminalUI();
        } else {
            window.saveAdminData();
        }
    });
};

window.initStaffApp = (user) => {
    document.getElementById('staff-app').classList.remove('hidden');
    
    state.unsubs.userData = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'app_state'), (snap) => {
        if(snap.exists()) {
            const d = JSON.parse(snap.data().json);
            state.appData = { ...state.appData, ...d };
            document.getElementById('staff-notes-input').value = state.appData.notes || '';
            window.updateStaffUI();
            window.renderStaffChart();
        } else {
            window.saveStaffData();
        }
    });
};

window.switchDept = (dept) => {
    // Manager Guard: Prevent switching if they only manage one side
    if (state.userRole === 'manager_soft' && dept === 'hard') return window.showToast("Access Denied: You only manage Soft.");
    if (state.userRole === 'manager_hard' && dept === 'soft') return window.showToast("Access Denied: You only manage Hard.");

    state.currentDept = dept;
    
    // Staff UI Colors
    const stfSoft = document.getElementById('stf-dept-soft');
    const stfHard = document.getElementById('stf-dept-hard');
    if(stfSoft && stfHard) {
        stfSoft.className = dept === 'soft' ? "flex-1 py-1.5 rounded-lg font-bold text-xs bg-blue-600 text-white shadow transition btn-interactive" : "flex-1 py-1.5 rounded-lg font-bold text-xs text-blue-200 hover:text-white transition btn-interactive";
        stfHard.className = dept === 'hard' ? "flex-1 py-1.5 rounded-lg font-bold text-xs bg-blue-600 text-white shadow transition btn-interactive" : "flex-1 py-1.5 rounded-lg font-bold text-xs text-blue-200 hover:text-white transition btn-interactive";
    }

    // Admin UI Colors
    const admSoft = document.getElementById('adm-dept-soft');
    const admHard = document.getElementById('adm-dept-hard');
    if(admSoft && admHard) {
        admSoft.className = dept === 'soft' ? "flex-1 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white shadow transition btn-interactive" : "flex-1 py-1.5 text-xs font-bold rounded-lg text-gray-400 hover:text-white transition btn-interactive";
        admHard.className = dept === 'hard' ? "flex-1 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white shadow transition btn-interactive" : "flex-1 py-1.5 text-xs font-bold rounded-lg text-gray-400 hover:text-white transition btn-interactive";
    }

    // Force UI Refresh based on role
    if(state.userRole.includes('admin') || state.userRole.includes('manager')) {
        window.admUpdateMasterLabels();
        window.processAdminRosterUI();
        window.updateFinanceUI();
        if(state.currentDetailUid) window.updateDetailView();
    }
    if(state.userRole === 'staff') {
        window.updateMasterLabels();
        window.updateStaffUI();
    }
};

window.switchStaffTab = (tab) => {
    ['terminal','stats','tools'].forEach(x => {
        document.getElementById(`staff-view-${x}`).classList.remove('active');
        document.getElementById(`staff-view-${x}`).classList.add('hidden');
        document.getElementById(`stf-tab-${x}`).classList.remove('bg-white', 'text-blue-800', 'dark:bg-gray-700', 'dark:text-white', 'shadow');
        document.getElementById(`stf-tab-${x}`).classList.add('text-blue-100', 'dark:text-gray-400');
    });
    document.getElementById(`staff-view-${tab}`).classList.remove('hidden');
    document.getElementById(`staff-view-${tab}`).classList.add('active');
    document.getElementById(`stf-tab-${tab}`).classList.remove('text-blue-100', 'dark:text-gray-400');
    document.getElementById(`stf-tab-${tab}`).classList.add('bg-white', 'text-blue-800', 'dark:bg-gray-700', 'dark:text-white', 'shadow');
};

window.switchAdminTab = (tab) => {
    ['storage', 'terminal', 'staff', 'transfers', 'finance', 'ious'].forEach(t => {
        const el = document.getElementById(`admin-view-${t}`);
        const btn = document.getElementById(`adm-tab-${t}`);
        if (el) { el.classList.remove('active'); el.classList.add('hidden'); }
        if (btn) {
            btn.classList.remove('bg-gray-800', 'text-white', 'shadow');
            btn.classList.add('bg-white', 'dark:bg-gray-800', 'text-gray-600', 'dark:text-gray-300');
        }
    });
    const selectedView = document.getElementById(`admin-view-${tab}`);
    const selectedBtn = document.getElementById(`adm-tab-${tab}`);
    if (selectedView) { selectedView.classList.remove('hidden'); selectedView.classList.add('active'); }
    if (selectedBtn) {
        selectedBtn.classList.remove('bg-white', 'dark:bg-gray-800', 'text-gray-600', 'dark:text-gray-300');
        selectedBtn.classList.add('bg-gray-800', 'text-white', 'shadow');
    }
    if(tab === 'finance') window.loadGlobalAnalytics();
};

// ============================================================================
// STAFF LOGIC
// ============================================================================

window.saveStaffData = async () => {
    if(!state.currentUser) return;
    await setDoc(doc(db, 'artifacts', appId, 'users', state.currentUser.uid, 'data', 'app_state'), { 
        json: JSON.stringify(state.appData), 
        lastUpdated: Date.now() 
    });
    try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'roster', state.currentUser.uid), { 
            weight_soft: state.appData.weight_soft, unitsFull_soft: state.appData.unitsFull_soft, unitsUsual_soft: state.appData.unitsUsual_soft,
            soldWeight_soft: state.appData.soldWeight_soft, soldUnitsFull_soft: state.appData.soldUnitsFull_soft, soldUnitsUsual_soft: state.appData.soldUnitsUsual_soft,
            weight_hard: state.appData.weight_hard, unitsFull_hard: state.appData.unitsFull_hard, unitsUsual_hard: state.appData.unitsUsual_hard,
            soldWeight_hard: state.appData.soldWeight_hard, soldUnitsFull_hard: state.appData.soldUnitsFull_hard, soldUnitsUsual_hard: state.appData.soldUnitsUsual_hard,
            personalUseWeight: state.appData.personalUseWeight, personalUseOwed: state.appData.personalUseOwed,
            borrowings: state.appData.borrowings, cashDropped: state.appData.cashDropped, collected: state.appData.collected,
            expected: state.appData.expected, expenses: state.appData.expenses, recentLogs: state.appData.transactions.slice(-10).reverse(), lastSync: Date.now() 
        }, { merge: true });
    } catch(e){}
};

window.updateStaffUI = () => {
    // Dynamically load the correct values based on state.currentDept
    window.animateValue('staff-stock', parseFloat(document.getElementById('staff-stock').innerText), state.appData[getAF('weight')] || 0, 400, '');
    document.getElementById('staff-stock-full').innerText = state.appData[getAF('unitsFull')] || 0;
    document.getElementById('staff-stock-usual').innerText = state.appData[getAF('unitsUsual')] || 0;
    
    const currentNet = state.appData.collected - state.appData.expenses - state.appData.cashDropped;
    window.animateValue('staff-stat-net', parseFloat(document.getElementById('staff-stat-net').innerText.replace('$','')), currentNet, 500, '$', true);
    window.animateValue('staff-stat-money', parseFloat(document.getElementById('staff-stat-money').innerText.replace('$','')), state.appData.collected, 500, '$', true);
    window.animateValue('staff-stat-expenses', parseFloat(document.getElementById('staff-stat-expenses').innerText.replace('$','')), state.appData.expenses, 500, '$', true);
    
    const grossComm = state.appData.collected * ((state.masterData.staffCommission || 0) / 100);
    const totalDebt = (state.appData.personalUseOwed || 0) + (state.appData.borrowings || 0);
    const appliedToDebt = Math.min(grossComm, totalDebt);
    const netComm = grossComm - appliedToDebt;
    const remDebt = totalDebt - appliedToDebt;

    document.getElementById('staff-calc-gross-comm').innerText = `$${grossComm.toFixed(2)}`;
    document.getElementById('staff-calc-total-debt').innerText = `$${totalDebt.toFixed(2)}`;
    document.getElementById('staff-calc-applied').innerText = `-$${appliedToDebt.toFixed(2)}`;
    document.getElementById('staff-calc-net-comm').innerText = `$${netComm.toFixed(2)}`;
    document.getElementById('staff-calc-rem-debt').innerText = `$${remDebt.toFixed(2)}`;

    const diff = state.appData.expected - state.appData.collected;
    const warn = document.getElementById('staff-shortage-warning');
    if(diff > 0) {
        warn.classList.remove('hidden');
        document.getElementById('staff-shortage-amount').innerText = `$${diff.toFixed(2)}`;
    } else {
        warn.classList.add('hidden');
    }

    const logList = document.getElementById('staff-log-list');
    logList.innerHTML = '';
    state.appData.transactions.slice(-15).reverse().forEach(t => {
        let text = ''; let color = 'text-gray-500'; let icon = 'circle';
        if(t.type === 'sale') { text = `Sold ${t.qty} ${t.unitType} (${t.dept}) for $${t.money}`; color = 'text-green-500'; icon = 'check-circle'; }
        else if(t.type === 'personal') { text = `Used ${t.qty} ${t.unitType} (${t.dept}) (Owe $${t.owed})`; color = 'text-purple-500'; icon = 'user'; }
        else if(t.type === 'expense') { text = `Expense: ${t.desc} ($${t.money})`; color = 'text-orange-500'; icon = 'fuel'; }
        else if(t.type === 'dropoff') { text = `Dropped off $${t.money} to Boss`; color = 'text-blue-500'; icon = 'hand-coins'; }
        
        logList.innerHTML += `<div class="flex items-center border-b dark:border-gray-700 py-2"><i data-lucide="${icon}" class="w-4 h-4 mr-2 ${color}"></i> <span>${text}</span></div>`;
    });
    
    window.updateStaffGlobalStats();
    if(typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
};

window.updateMasterLabels = () => {
    const labelFull = document.getElementById('label-full-weight'); 
    const labelUsual = document.getElementById('label-usual-weight'); 
    const expHint = document.getElementById('expected-money-hint');
    
    const price = state.masterData[getMF('pricePerUnit')] || 100;
    const ratio = state.masterData[getMF('usualRatio')] || 0.8;

    if(labelFull) labelFull.innerText = `(${(state.currentQty * 1.0).toFixed(1)} units)`; 
    if(labelUsual) labelUsual.innerText = `(${(state.currentQty * ratio).toFixed(1)} units)`;
    
    const unitPrice = state.currentType === 'full' ? price : (price * ratio);
    if(expHint) expHint.innerText = `Expected: $${state.currentQty * unitPrice}`;

    const btnUsual = document.getElementById('btn-quick-usual'); 
    const btnFull = document.getElementById('btn-quick-full');
    if(btnUsual) btnUsual.innerText = `$${price * ratio} (Usual)`; 
    if(btnFull) btnFull.innerText = `$${price} (Full)`;
};

window.selectQty = (q) => { 
    state.currentQty = q; 
    document.querySelectorAll('.qty-btn').forEach(b => b.classList.remove('active')); 
    document.getElementById(`btn-qty-${q}`).classList.add('active'); 
    window.updateMasterLabels(); 
    window.checkPriceColor();
};

window.selectType = (t) => { 
    state.currentType = t; 
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active')); 
    document.getElementById(`btn-type-${t}`).classList.add('active'); 
    window.updateMasterLabels(); 
    window.checkPriceColor();
};

window.checkPriceColor = () => {
    const input = document.getElementById('money-input');
    if(!input) return;
    const val = parseFloat(input.value) || 0;
    
    const price = state.masterData[getMF('pricePerUnit')] || 100;
    const ratio = state.masterData[getMF('usualRatio')] || 0.8;
    const expected = state.currentType === 'full' ? (state.currentQty * price) : (state.currentQty * price * ratio);
    
    input.classList.remove('text-gray-400', 'text-red-500', 'text-orange-500', 'text-green-500', 'dark:text-white', 'dark:text-red-500', 'dark:text-orange-500', 'dark:text-green-500');
    
    if (val === 0) { input.classList.add('dark:text-white', 'text-gray-800'); return; }
    
    if (val < expected) input.classList.add('text-red-500', 'dark:text-red-500');
    else input.classList.add('text-green-500', 'dark:text-green-500');
};

window.setQuickPrice = (amt) => { 
    document.getElementById('money-input').value = amt * state.currentQty; 
    window.checkPriceColor(); 
};

window.processSale = async () => {
    if(state.currentQty <= 0) return window.showToast("Select quantity.");
    const money = parseFloat(document.getElementById('money-input').value);
    if(isNaN(money) || money < 0) return window.showToast("Enter valid money received.");

    const source = document.getElementById('staff-sale-source').value;
    const price = state.masterData[getMF('pricePerUnit')] || 100;
    const ratio = state.masterData[getMF('usualRatio')] || 0.8;
    
    const exactWeight = state.currentType === 'full' ? state.currentQty * 1.0 : state.currentQty * ratio;
    const expected = state.currentType === 'full' ? state.currentQty * price : state.currentQty * price * ratio;

    if(source === 'raw') {
        if((state.appData[getAF('weight')] || 0) < exactWeight) return window.showToast("Not enough Raw Weight!");
        state.appData[getAF('weight')] -= exactWeight;
    } else {
        if(state.currentType === 'full') {
            if((state.appData[getAF('unitsFull')] || 0) < state.currentQty) return window.showToast("Not enough Full Units!");
            state.appData[getAF('unitsFull')] -= state.currentQty;
        } else {
            if((state.appData[getAF('unitsUsual')] || 0) < state.currentQty) return window.showToast("Not enough Usual Units!");
            state.appData[getAF('unitsUsual')] -= state.currentQty;
        }
    }

    if(state.currentType === 'full') state.appData[getAF('soldUnitsFull')] = (state.appData[getAF('soldUnitsFull')] || 0) + state.currentQty;
    if(state.currentType === 'usual') state.appData[getAF('soldUnitsUsual')] = (state.appData[getAF('soldUnitsUsual')] || 0) + state.currentQty;
    if(source === 'raw') state.appData[getAF('soldWeight')] = (state.appData[getAF('soldWeight')] || 0) + exactWeight;

    state.appData.collected += money;
    state.appData.expected += expected;

    state.appData.transactions.push({ 
        id: Date.now(), time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), 
        type: 'sale', qty: state.currentQty, unitType: state.currentType, source: source, dept: state.currentDept,
        weightUsed: exactWeight, money: money, expected: expected, date: new Date().toISOString() 
    });

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventory', 'master'), { cashBalance: increment(money) }, {merge:true});
    await window.saveStaffData();

    document.getElementById('money-input').value = '';
    window.checkPriceColor();
    window.showToast(`Sale logged for ${state.currentDept.toUpperCase()} department!`);
    window.selectQty(1);
};

window.staffPersonalUse = async () => {
    const source = document.getElementById('staff-sale-source').value;
    const price = state.masterData[getMF('pricePerUnit')] || 100;
    const ratio = state.masterData[getMF('usualRatio')] || 0.8;
    const unitPrice = state.currentType === 'full' ? price : price * ratio;
    
    if(!confirm(`Log Personal Use for ${state.currentQty} ${state.currentType.toUpperCase()} units from ${source.toUpperCase()} inventory?\n\nYou will be charged the standard price at a ${state.masterData.staffDiscount}% discount.`)) return;

    const exactWeight = state.currentType === 'full' ? state.currentQty * 1.0 : state.currentQty * ratio;

    if(source === 'raw') {
        if((state.appData[getAF('weight')] || 0) < exactWeight) return window.showToast("Not enough Raw Weight!");
        state.appData[getAF('weight')] -= exactWeight;
    } else {
        if(state.currentType === 'full') {
            if((state.appData[getAF('unitsFull')] || 0) < state.currentQty) return window.showToast("Not enough Full Units!");
            state.appData[getAF('unitsFull')] -= state.currentQty;
        } else {
            if((state.appData[getAF('unitsUsual')] || 0) < state.currentQty) return window.showToast("Not enough Usual Units!");
            state.appData[getAF('unitsUsual')] -= state.currentQty;
        }
    }

    const standardCost = state.currentQty * unitPrice;
    const discountMultiplier = 1 - (state.masterData.staffDiscount / 100);
    const oweAmount = standardCost * discountMultiplier;

    state.appData.personalUseWeight = (state.appData.personalUseWeight || 0) + exactWeight;
    state.appData.expected += oweAmount; 
    state.appData.personalUseOwed = (state.appData.personalUseOwed || 0) + oweAmount;
    
    state.appData.transactions.push({ 
        id: Date.now(), time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), 
        type: 'personal', qty: state.currentQty, unitType: state.currentType, source: source, dept: state.currentDept,
        weightUsed: exactWeight, money: 0, expected: standardCost, owed: oweAmount, date: new Date().toISOString() 
    });

    await window.saveStaffData();
    window.showToast(`Logged ${state.currentType.toUpperCase()} unit(s) for personal use. You owe $${oweAmount.toFixed(2)}.`);
    window.selectQty(1);
};

// ============================================================================
// ADMIN LOGIC
// ============================================================================

window.saveAdminData = async () => { 
    if(!state.currentUser) return; 
    await setDoc(doc(db, 'artifacts', appId, 'users', state.currentUser.uid, 'data', 'app_state'), { 
        json: JSON.stringify(state.adminData), lastUpdated: Date.now() 
    }); 
    try { 
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'roster', state.currentUser.uid), { 
            soldWeight_soft: state.adminData.soldWeight_soft, soldUnitsFull_soft: state.adminData.soldUnitsFull_soft, soldUnitsUsual_soft: state.adminData.soldUnitsUsual_soft,
            soldWeight_hard: state.adminData.soldWeight_hard, soldUnitsFull_hard: state.adminData.soldUnitsFull_hard, soldUnitsUsual_hard: state.adminData.soldUnitsUsual_hard,
            collected: state.adminData.collected, expected: state.adminData.expected, recentLogs: state.adminData.transactions.slice(-10).reverse(), lastSync: Date.now() 
        }, { merge: true }); 
    } catch(e){} 
};

window.admUpdateMasterLabels = () => {
    const labelFull = document.getElementById('adm-label-full-weight'); 
    const labelUsual = document.getElementById('adm-label-usual-weight'); 
    const expHint = document.getElementById('adm-expected-money-hint');
    
    const price = state.masterData[getMF('pricePerUnit')] || 100;
    const ratio = state.masterData[getMF('usualRatio')] || 0.8;

    if(labelFull) labelFull.innerText = `(${(state.admCurrentQty * 1.0).toFixed(1)} units)`; 
    if(labelUsual) labelUsual.innerText = `(${(state.admCurrentQty * ratio).toFixed(1)} units)`;
    
    const unitPrice = state.admCurrentType === 'full' ? price : (price * ratio);
    if(expHint) expHint.innerText = `Expected: $${(state.admCurrentQty * unitPrice).toFixed(2)}`;

    // Also update UI cards dynamically
    const pDisp = document.getElementById('admin-price-display'); 
    const rDisp = document.getElementById('admin-ratio-display'); 
    const uFull = document.getElementById('admin-stock-full'); 
    const uUsual = document.getElementById('admin-stock-usual');
    const masterWeight = document.getElementById('admin-master-weight');
    const masterEqWeight = document.getElementById('admin-master-eq-weight');

    if(pDisp) pDisp.innerText = `$${price}`; 
    if(rDisp) rDisp.innerText = `${ratio}x`; 
    if(uFull) uFull.innerText = state.masterData[getMF('unitsFull')] || 0; 
    if(uUsual) uUsual.innerText = state.masterData[getMF('unitsUsual')] || 0;
    if(masterWeight) masterWeight.innerText = (state.masterData[getMF('rawWeight')] || 0).toFixed(1);

    if (masterEqWeight) { 
        const rawW = state.masterData[getMF('rawWeight')] || 0;
        const totalEq = rawW + ((state.masterData[getMF('unitsFull')] || 0) * 1.0) + ((state.masterData[getMF('unitsUsual')] || 0) * ratio); 
        masterEqWeight.innerText = `${totalEq.toFixed(1)} u`; 
    }

    const previewFull = document.getElementById('preview-max-full');
    const previewUsual = document.getElementById('preview-max-usual');
    if (previewFull && previewUsual) {
        const rawW = state.masterData[getMF('rawWeight')] || 0;
        previewFull.innerText = `${Math.floor(rawW / 1.0)} Full`;
        previewUsual.innerText = `${Math.floor(rawW / (ratio > 0 ? ratio : 1))} Usual`;
    }
};

window.admSelectQty = (q) => { 
    state.admCurrentQty = q; 
    document.querySelectorAll('.adm-qty-btn').forEach(b => b.classList.remove('active')); 
    const btn = document.getElementById(`adm-btn-qty-${q}`);
    if(btn) btn.classList.add('active'); 
    window.admUpdateMasterLabels(); 
    window.admCheckPriceColor(); 
};

window.admSelectType = (t) => { 
    state.admCurrentType = t; 
    document.querySelectorAll('.adm-type-btn').forEach(b => b.classList.remove('active')); 
    const btn = document.getElementById(`adm-btn-type-${t}`);
    if(btn) btn.classList.add('active'); 
    window.admUpdateMasterLabels(); 
    window.admCheckPriceColor(); 
};

window.admCheckPriceColor = () => {
    const input = document.getElementById('adm-money-input'); 
    if(!input) return;
    const val = parseFloat(input.value) || 0; 
    const price = state.masterData[getMF('pricePerUnit')] || 100;
    const ratio = state.masterData[getMF('usualRatio')] || 0.8;
    const expected = state.admCurrentType === 'full' ? (state.admCurrentQty * price) : (state.admCurrentQty * price * ratio);
    
    input.classList.remove('text-gray-400', 'text-red-500', 'text-orange-500', 'text-green-500', 'dark:text-white', 'dark:text-red-500', 'dark:text-orange-500', 'dark:text-green-500');
    
    if (val === 0) { input.classList.add('dark:text-white', 'text-gray-800'); return; }
    if (val < expected) input.classList.add('text-red-500', 'dark:text-red-500'); 
    else input.classList.add('text-green-500', 'dark:text-green-500');
};

window.adminProcessSale = async () => {
    if(state.admCurrentQty <= 0) return window.showToast("Select quantity.");
    const money = parseFloat(document.getElementById('adm-money-input').value);
    if(isNaN(money) || money < 0) return window.showToast("Enter valid money received");

    const source = document.getElementById('adm-sale-source').value;
    const price = state.masterData[getMF('pricePerUnit')] || 100;
    const ratio = state.masterData[getMF('usualRatio')] || 0.8;
    const exactWeight = state.admCurrentType === 'full' ? state.admCurrentQty * 1.0 : state.admCurrentQty * ratio;
    const expected = state.admCurrentType === 'full' ? state.admCurrentQty * price : state.admCurrentQty * price * ratio;

    let masterUpdate = {};

    if (source === 'raw') {
        if((state.masterData[getMF('rawWeight')]||0) < exactWeight) return window.showToast(`Not enough ${state.currentDept} raw weight!`);
        masterUpdate[getMF('rawWeight')] = increment(-exactWeight);
    } else {
        if (state.admCurrentType === 'full') {
            if((state.masterData[getMF('unitsFull')]||0) < state.admCurrentQty) return window.showToast(`Not enough Full Pre-Packs!`);
            masterUpdate[getMF('unitsFull')] = increment(-state.admCurrentQty);
        } else {
            if((state.masterData[getMF('unitsUsual')]||0) < state.admCurrentQty) return window.showToast(`Not enough Usual Pre-Packs!`);
            masterUpdate[getMF('unitsUsual')] = increment(-state.admCurrentQty);
        }
    }

    masterUpdate.cashBalance = increment(money);

    state.adminData.collected += money; 
    state.adminData.expected += expected;
    
    if (source === 'raw') state.adminData[getAF('soldWeight')] = (state.adminData[getAF('soldWeight')]||0) + exactWeight;
    else if (state.admCurrentType === 'full') state.adminData[getAF('soldUnitsFull')] = (state.adminData[getAF('soldUnitsFull')]||0) + state.admCurrentQty;
    else state.adminData[getAF('soldUnitsUsual')] = (state.adminData[getAF('soldUnitsUsual')]||0) + state.admCurrentQty;

    state.adminData.transactions.push({ 
        id: Date.now(), time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), 
        source: source, qty: state.admCurrentQty, type: state.admCurrentType, dept: state.currentDept,
        actualWeight: exactWeight, money: money, expected: expected 
    });

    await setDoc(doc(db,'artifacts',appId,'public','data','inventory','master'), masterUpdate, {merge:true});
    await window.saveAdminData(); 
    
    document.getElementById('adm-money-input').value = '';
    window.showToast("Admin Sale Logged!");
};

// ============================================================================
// ADMIN ROSTER & PERMISSIONS
// ============================================================================

window.processAdminRosterUI = () => {
    const list = document.getElementById('admin-staff-list'); 
    const select = document.getElementById('transfer-staff-select'); 
    const pendingList = document.getElementById('admin-pending-users'); 
    
    if(!list || !select) return;
    list.innerHTML=''; 
    select.innerHTML='<option value="">Select Staff...</option>'; 
    if(pendingList) pendingList.innerHTML='';
    
    let activeCount = 0; 
    let globalRaw = 0, globalFull = 0, globalUsual = 0;

    state.globalRoster.forEach(u => {
        if(u.status === 'pending') {
            if (u.role !== 'admin' && pendingList) {
                pendingList.innerHTML += `
                    <div class="flex justify-between items-center p-2 bg-orange-50 dark:bg-orange-900/20 rounded border border-orange-100 dark:border-orange-800">
                        <span class="font-bold text-orange-800 dark:text-orange-300">${u.name}</span>
                        <div>
                            <button onclick="window.adminSetStatus('${u.id}', 'active')" class="bg-green-500 text-white text-xs px-3 py-1 rounded font-bold mr-1 hover:bg-green-600 btn-interactive">Approve</button>
                            <button onclick="window.adminDelUser('${u.id}')" class="text-red-500 text-xs px-2 hover:underline">Deny</button>
                        </div>
                    </div>`;
            }
        } else {
            activeCount++; 
            
            // For UI metrics, only pull from the ACTIVE department tab
            const uWeight = u[getAF('weight')] || 0;
            const uFull = u[getAF('unitsFull')] || 0;
            const uUsual = u[getAF('unitsUsual')] || 0;
            const uSoldWeight = u[getAF('soldWeight')] || 0;

            if (u.role !== 'admin') { 
                globalRaw += uWeight; 
                globalFull += uFull; 
                globalUsual += uUsual; 
            }
            
            const diff = (u.expected || 0) - (u.collected || 0);
            const diffColor = diff > 0 ? 'text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200' : (diff < 0 ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-500 bg-gray-50 dark:bg-gray-800');
            const diffSign = diff > 0 ? `-$${diff.toFixed(2)}` : (diff < 0 ? `+$${Math.abs(diff).toFixed(2)}` : '$0');

            // Format Badges based on role
            let badge = '';
            if (u.role === 'admin') badge = '<span class="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full ml-2">ADMIN</span>';
            else if (u.role === 'manager_soft') badge = '<span class="bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-full ml-2">SOFT MGR</span>';
            else if (u.role === 'manager_hard') badge = '<span class="bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-full ml-2">HARD MGR</span>';

            list.innerHTML += `
                <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer hover:border-blue-400 transition" onclick="window.viewDriverDetails('${u.id}')">
                    <div class="flex justify-between items-center mb-2">
                        <div class="font-bold dark:text-white flex items-center">
                            <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs mr-2 border border-blue-200">${u.name[0]}</div>
                            ${u.name} ${badge}
                        </div>
                        <div class="text-right">
                            <div class="text-xs text-gray-500">${u.role === 'admin' ? 'Total Sold' : 'Holding'}</div>
                            <div class="font-black dark:text-white">${u.role === 'admin' ? uSoldWeight.toFixed(1) : uWeight.toFixed(1)} u</div>
                        </div>
                    </div>
                    <div class="flex justify-between items-end border-t dark:border-gray-700 pt-2">
                        <div class="text-xs text-gray-500">
                            Exp: <span class="font-bold text-gray-800 dark:text-gray-300">$${(u.expected||0).toFixed(2)}</span><br>
                            Col: <span class="font-bold text-green-600">$${(u.collected||0).toFixed(2)}</span>
                        </div>
                        <div class="text-xs font-bold px-2 py-1 rounded ${diffColor}">
                            Diff: ${diffSign}
                        </div>
                    </div>
                </div>`;
            
            if (u.role !== 'admin') { 
                const opt = document.createElement('option'); 
                opt.value=u.id; 
                opt.innerText=`${u.name} (${uWeight.toFixed(1)} u)`; 
                select.appendChild(opt); 
            }
        }
    });
    
    const activeCountEl = document.getElementById('admin-active-count');
    if(activeCountEl) activeCountEl.innerText = `${activeCount} Active`; 
    
    const glRawEl = document.getElementById('global-stock-raw');
    if(glRawEl) glRawEl.innerText = ((state.masterData[getMF('rawWeight')] || 0) + globalRaw).toFixed(1); 
    
    const glFullEl = document.getElementById('global-stock-full');
    if(glFullEl) glFullEl.innerText = ((state.masterData[getMF('unitsFull')] || 0) + globalFull); 
    
    const glUsualEl = document.getElementById('global-stock-usual');
    if(glUsualEl) glUsualEl.innerText = ((state.masterData[getMF('unitsUsual')] || 0) + globalUsual);
    
    if(typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
};

window.viewDriverDetails = async (uid) => {
    const u = state.globalRoster.find(x => x.id === uid); 
    if(!u) return; 
    state.currentDetailUid = uid;
    
    document.getElementById('detail-user-name').innerText = u.name;
    
    // Check if they manage a specific department
    if(state.userRole === 'admin') {
        const roleSelect = document.getElementById('det-role-select');
        if(roleSelect) roleSelect.value = u.role || 'staff';
    }

    document.getElementById('det-holding-raw').innerText = (u[getAF('weight')] || 0).toFixed(1);
    document.getElementById('det-holding-full').innerText = (u[getAF('unitsFull')] || 0);
    document.getElementById('det-holding-usual').innerText = (u[getAF('unitsUsual')] || 0);
    
    document.getElementById('det-sold-raw').innerText = (u[getAF('soldWeight')] || 0).toFixed(1);
    document.getElementById('det-sold-full').innerText = (u[getAF('soldUnitsFull')] || 0);
    document.getElementById('det-sold-usual').innerText = (u[getAF('soldUnitsUsual')] || 0);
    
    document.getElementById('det-expected').innerText = `$${(u.expected || 0).toFixed(2)}`;
    document.getElementById('det-collected').innerText = `$${(u.collected || 0).toFixed(2)}`;
    document.getElementById('det-expenses').innerText = `-$${(u.expenses || 0).toFixed(2)}`;
    document.getElementById('det-cash-dropped').innerText = `-$${(u.cashDropped || 0).toFixed(2)}`;

    const grossComm = (u.collected || 0) * ((state.masterData.staffCommission || 0) / 100);
    const totalDebt = (u.personalUseOwed || 0) + (u.borrowings || 0);
    const appliedToDebt = Math.min(grossComm, totalDebt);
    const netComm = grossComm - appliedToDebt;

    document.getElementById('det-calc-gross-comm').innerText = `$${grossComm.toFixed(2)}`;
    document.getElementById('det-calc-total-debt').innerText = `$${totalDebt.toFixed(2)}`;
    document.getElementById('det-calc-applied').innerText = `-$${appliedToDebt.toFixed(2)}`;
    document.getElementById('det-calc-net-comm').innerText = `$${netComm.toFixed(2)}`;
    document.getElementById('det-calc-rem-debt').innerText = `$${(totalDebt - appliedToDebt).toFixed(2)}`;
    
    const cashOnHand = (u.collected || 0) - (u.expenses || 0) - netComm - (u.cashDropped || 0);
    document.getElementById('det-net-cash').innerText = `$${cashOnHand.toFixed(2)}`;

    const diff = (u.expected || 0) - (u.collected || 0);
    const dbx = document.getElementById('det-diff-box');
    dbx.className = `p-3 rounded-lg flex justify-between items-center font-bold mb-4 ${diff > 0 ? 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' : (diff < 0 ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400')}`;
    document.getElementById('det-diff').innerText = diff > 0 ? `-$${diff.toFixed(2)}` : (diff < 0 ? `+$${Math.abs(diff).toFixed(2)}` : '$0');

    document.getElementById('admin-user-detail').classList.remove('hidden');
};

window.adminChangeRole = async () => {
    if(!state.currentDetailUid) return;
    const newRole = document.getElementById('det-role-select').value;
    if(!confirm(`Change this user's role to ${newRole.toUpperCase()}?`)) {
        // Revert UI dropdown if they cancel
        const u = state.globalRoster.find(x => x.id === state.currentDetailUid); 
        document.getElementById('det-role-select').value = u ? (u.role || 'staff') : 'staff';
        return;
    }
    
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'roster', state.currentDetailUid), { role: newRole }, {merge:true});
    await setDoc(doc(db, 'artifacts', appId, 'users', state.currentDetailUid, 'settings', 'profile'), { role: newRole }, {merge:true});
    window.showToast(`User permissions updated to ${newRole.toUpperCase()}`);
};

// ============================================================================
// BOOT THE APP
// ============================================================================
initAuth();
>>>>>>> 943371159b2a0c16dfbdb9797471b19326c71169
