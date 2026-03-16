import { doc, setDoc, addDoc, collection, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, appId } from "./firebase-config.js";
import { state } from "./state.js";

// ============================================================================
// ALERTS / NOTIFICATIONS HELPER
// ============================================================================

window.sendNotificationAlert = async (targetUid, message) => { 
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'alerts'), { 
        target: targetUid, 
        message: message, 
        timestamp: Date.now() 
    }); 
};

// ============================================================================
// STAFF ACTIONS: EXPENSES, DROPS & VOIDS
// ============================================================================

window.staffExpense = async () => {
    const desc = prompt("What is this expense for? (e.g., Gas, Food)"); 
    if(!desc) return;
    const amt = parseFloat(prompt(`How much did you spend on ${desc}? ($)`)); 
    if(isNaN(amt) || amt <= 0) return;
    
    state.appData.expenses = (state.appData.expenses || 0) + amt;
    state.appData.transactions.push({ 
        id: Date.now(), 
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), 
        qty: 0, 
        type: 'expense', 
        actualWeight: 0, 
        money: -amt, 
        expected: 0, 
        desc: desc 
    });
    
    await window.saveStaffData(); 
    window.showToast("Expense Logged.");
};

window.staffDropCash = async () => {
    const grossComm = (state.appData.collected || 0) * ((state.masterData.staffCommission || 0) / 100);
    const totalDebt = (state.appData.personalUseOwed || 0) + (state.appData.borrowings || 0);
    const appliedToDebt = Math.min(grossComm, totalDebt);
    const netComm = grossComm - appliedToDebt;

    const currentNet = (state.appData.collected || 0) - (state.appData.expenses || 0) - netComm - (state.appData.cashDropped || 0);
    
    if(currentNet <= 0) return window.showToast("No cash to drop off.");
    
    const amtStr = prompt(`You hold $${currentNet.toFixed(2)}.\nHow much are you dropping to Boss?`, currentNet.toFixed(2));
    if(!amtStr) return;
    const amt = parseFloat(amtStr);
    if(isNaN(amt) || amt <= 0 || amt > currentNet) return window.showToast("Invalid amount.");

    state.appData.cashDropped = (state.appData.cashDropped || 0) + amt;
    state.appData.transactions.push({ 
        id: Date.now(), 
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), 
        qty: 0, 
        type: 'dropoff', 
        actualWeight: 0, 
        money: 0, 
        expected: 0, 
        amt: amt, 
        desc: 'Dropped off cash' 
    });
    
    await window.saveStaffData(); 
    
    // Add physical cash back to Master Balance
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventory', 'master'), {
        cashBalance: increment(amt)
    }, {merge:true});
    
    window.showToast(`Dropped $${amt.toFixed(2)} to Boss Vault.`);
    window.sendNotificationAlert('admin', `${window.currentUserName} dropped off $${amt} cash.`);
};

window.undoLastTransaction = async () => {
    if(!state.appData.transactions || state.appData.transactions.length === 0) return window.showToast("No transactions to undo.");
    if(!confirm("Are you SURE you want to completely VOID your last entry? This will reverse the math perfectly.")) return;
    
    const t = state.appData.transactions.pop();
    
    // Fallback to 'soft' for legacy data that might not have a department set
    const dept = t.dept || 'soft'; 
    
    const fWeight = `weight_${dept}`;
    const fFull = `unitsFull_${dept}`;
    const fUsual = `unitsUsual_${dept}`;
    const sWeight = `soldWeight_${dept}`;
    const sFull = `soldUnitsFull_${dept}`;
    const sUsual = `soldUnitsUsual_${dept}`;

    if(t.type === 'expense') { 
        state.appData.expenses -= Math.abs(t.money); 
    } else if (t.type === 'dropoff') { 
        state.appData.cashDropped -= t.amt; 
        await setDoc(doc(db,'artifacts',appId,'public','data','inventory','master'), { cashBalance: increment(-t.amt) }, {merge:true});
    } else if (t.type === 'borrowing') { 
        state.appData.borrowings -= t.expected; 
        state.appData.expected -= t.expected; 
    } else if (t.type === 'personal') {
        state.appData.personalUseWeight -= t.actualWeight; 
        state.appData.expected -= t.expected; 
        state.appData.personalUseOwed -= t.expected;
        
        if (t.source === 'raw') state.appData[fWeight] = (state.appData[fWeight] || 0) + t.actualWeight;
        else if (t.source === 'processed' && t.actualWeight === t.qty * 1.0) state.appData[fFull] = (state.appData[fFull] || 0) + t.qty;
        else if (t.source === 'processed' && t.actualWeight !== t.qty * 1.0) state.appData[fUsual] = (state.appData[fUsual] || 0) + t.qty;
    } else {
        // Reverse standard sale
        state.appData.collected -= t.money; 
        state.appData.expected -= t.expected;
        
        if (t.source === 'raw') { 
            state.appData[fWeight] = (state.appData[fWeight] || 0) + t.actualWeight; 
            state.appData[sWeight] = (state.appData[sWeight] || 0) - t.actualWeight; 
        } else if (t.source === 'processed' && (t.type === 'full' || t.unitType === 'full')) { 
            state.appData[fFull] = (state.appData[fFull] || 0) + t.qty; 
            state.appData[sFull] = (state.appData[sFull] || 0) - t.qty; 
        } else if (t.source === 'processed' && (t.type === 'usual' || t.unitType === 'usual')) { 
            state.appData[fUsual] = (state.appData[fUsual] || 0) + t.qty; 
            state.appData[sUsual] = (state.appData[sUsual] || 0) - t.qty; 
        }
        
        await setDoc(doc(db,'artifacts',appId,'public','data','inventory','master'), { 
            cashBalance: increment(-t.money) 
        }, {merge:true});
    }
    
    await window.saveStaffData(); 
    window.showToast("Last transaction successfully voided.");
};

// ============================================================================
// STAFF REQUESTS TO ADMIN
// ============================================================================

window.submitStaffBillReq = async () => {
    const desc = document.getElementById('req-bill-desc').value; 
    const amt = parseFloat(document.getElementById('req-bill-amt').value);
    
    if(!desc || isNaN(amt) || amt <= 0) return window.showToast("Enter description and valid amount.");
    
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'requests'), { 
        uid: state.currentUser.uid, 
        name: window.currentUserName || 'Staff', 
        timestamp: Date.now(), 
        status: 'pending', 
        type: 'bill_request', 
        desc: desc, 
        amount: amt 
    }); 
    
    document.getElementById('staff-bill-modal').classList.add('hidden'); 
    document.getElementById('req-bill-desc').value = ''; 
    document.getElementById('req-bill-amt').value = '';
    
    window.showToast("Bill Request Sent to Admin"); 
    window.sendNotificationAlert('admin', `New bill request from ${window.currentUserName}: $${amt}`);
};

window.submitStaffIOUReq = async () => {
    const name = document.getElementById('req-iou-name').value; 
    const contact = document.getElementById('req-iou-contact').value; 
    const amt = parseFloat(document.getElementById('req-iou-amt').value); 
    const date = document.getElementById('req-iou-date').value; 
    const qty = parseFloat(document.getElementById('req-iou-qty').value) || 0; 
    const type = document.getElementById('req-iou-type').value;
    
    if(!name || isNaN(amt) || amt <= 0) return window.showToast("Enter client name and valid amount.");
    
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'requests'), { 
        uid: state.currentUser.uid, 
        name: window.currentUserName || 'Staff', 
        timestamp: Date.now(), 
        status: 'pending', 
        type: 'iou_request', 
        clientName: name, 
        contact: contact, 
        amount: amt, 
        dueDate: date, 
        qty: qty, 
        iouType: type 
    }); 
    
    document.getElementById('staff-iou-modal').classList.add('hidden'); 
    document.getElementById('req-iou-name').value = ''; 
    document.getElementById('req-iou-contact').value = ''; 
    document.getElementById('req-iou-amt').value = ''; 
    document.getElementById('req-iou-date').value = ''; 
    document.getElementById('req-iou-qty').value = '';
    
    window.showToast("Finance Request Sent to Boss"); 
    window.sendNotificationAlert('admin', `New finance request from ${window.currentUserName} for client ${name} ($${amt})`);
};

window.requestWeight = async () => { 
    if(confirm("Notify admin you need more weight?")) { 
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'requests'), { 
            uid: state.currentUser.uid, 
            name: window.currentUserName || 'Staff', 
            timestamp: Date.now(), 
            status: 'pending', 
            type: 'weight' 
        }); 
        window.showToast("Request Sent"); 
        window.sendNotificationAlert('admin', `${window.currentUserName} is requesting more inventory.`); 
    } 
};