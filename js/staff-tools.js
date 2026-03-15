import { doc, setDoc, addDoc, collection, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, appId } from "./firebase-config.js";
import { state, getMF, getAF } from "./state.js";

window.promptExpense = async () => {
    const desc = prompt("What is this expense for? (e.g. Gas, Supplies)");
    if(!desc) return;
    const amt = parseFloat(prompt(`How much did you spend on ${desc}? ($)`));
    if(isNaN(amt) || amt <= 0) return window.showToast("Invalid amount");

    state.stf.expenses += amt;
    state.stf.txs.push({
        id: Date.now(), time: new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),
        type: 'expense', qty: 0, actualWeight: 0, money: -amt, expected: 0, desc: desc, dept: state.dept
    });

    await setDoc(doc(db, 'artifacts', appId, 'users', state.user.uid, 'data', 'app_state'), {json: JSON.stringify(state.stf), lastUpd: Date.now()});
    window.showToast("Expense logged!");
};

window.promptDropoff = async () => {
    const comm = (state.stf.collected || 0) * ((state.mst.staffCommission || 0) / 100);
    const debt = (state.stf.personalUseOwed || 0) + (state.stf.borrowings || 0);
    const applied = Math.min(comm, debt);
    const netComm = comm - applied;
    const currentNet = (state.stf.collected || 0) - (state.stf.expenses || 0) - (state.stf.cashDropped || 0) - netComm;

    if (currentNet <= 0) return window.showToast("Drawer is empty.");

    const amt = parseFloat(prompt(`Drawer contains $${currentNet.toFixed(2)}.\nAmount to drop to Boss:`, currentNet.toFixed(2)));
    if (isNaN(amt) || amt <= 0 || amt > currentNet) return window.showToast("Invalid amount.");

    state.stf.cashDropped += amt;
    state.stf.txs.push({
        id: Date.now(), time: new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),
        type: 'dropoff', qty: 0, actualWeight: 0, money: 0, amt: amt, expected: 0, desc: 'Cash Drop', dept: state.dept
    });

    await setDoc(doc(db, 'artifacts', appId, 'users', state.user.uid, 'data', 'app_state'), {json: JSON.stringify(state.stf), lastUpd: Date.now()});
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventory', 'master'), {cashBalance: increment(amt)}, {merge:true});
    window.showToast(`Dropped $${amt.toFixed(2)} to Master Vault.`);
};

window.undoLast = async () => {
    if(!state.stf.txs || state.stf.txs.length === 0) return window.showToast("No transactions to undo.");
    if(!confirm("Void the last transaction? This perfectly reverses the math.")) return;

    const t = state.stf.txs.pop();
    const fWeight = `weight_${t.dept||state.dept}`;
    const fFull = `unitsFull_${t.dept||state.dept}`;
    const fUsual = `unitsUsual_${t.dept||state.dept}`;
    const sWeight = `soldWeight_${t.dept||state.dept}`;
    const sFull = `soldUnitsFull_${t.dept||state.dept}`;
    const sUsual = `soldUnitsUsual_${t.dept||state.dept}`;

    if (t.type === 'expense') {
        state.stf.expenses -= Math.abs(t.money);
    } else if (t.type === 'dropoff') {
        state.stf.cashDropped -= t.amt;
        await setDoc(doc(db,'artifacts',appId,'public','data','inventory','master'), {cashBalance: increment(-t.amt)}, {merge:true});
    } else if (t.type === 'personal') {
        state.stf.personalUseWeight -= t.weightUsed;
        state.stf.expected -= t.expected;
        state.stf.personalUseOwed -= t.owed;
        if (t.source === 'raw') state.stf[fWeight] = (state.stf[fWeight]||0) + t.weightUsed;
        else if (t.unitType === 'full') state.stf[fFull] = (state.stf[fFull]||0) + t.qty;
        else state.stf[fUsual] = (state.stf[fUsual]||0) + t.qty;
    } else {
        state.stf.collected -= t.money;
        state.stf.expected -= t.expected;
        if (t.source === 'raw') {
            state.stf[fWeight] = (state.stf[fWeight]||0) + t.weight;
            state.stf[sWeight] = (state.stf[sWeight]||0) - t.weight;
        } else if (t.unitType === 'full' || t.type === 'full') {
            state.stf[fFull] = (state.stf[fFull]||0) + t.qty;
            state.stf[sFull] = (state.stf[sFull]||0) - t.qty;
        } else {
            state.stf[fUsual] = (state.stf[fUsual]||0) + t.qty;
            state.stf[sUsual] = (state.stf[sUsual]||0) - t.qty;
        }
    }

    await setDoc(doc(db, 'artifacts', appId, 'users', state.user.uid, 'data', 'app_state'), {json: JSON.stringify(state.stf), lastUpd: Date.now()});
    window.showToast("Voided successfully.");
};

window.reqResupply = async () => {
    if(confirm("Send an inventory restock request to the boss?")) {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'requests'), {
            uid: state.user.uid, name: document.getElementById('top-user-name').innerText,
            timestamp: Date.now(), status: 'pending', type: 'weight'
        });
        window.showToast("Request Sent");
    }
};

window.saveNotes = async () => {
    const val = document.getElementById('staff-notes').value;
    state.stf.notes = val;
    await setDoc(doc(db, 'artifacts', appId, 'users', state.user.uid, 'data', 'app_state'), {json: JSON.stringify(state.stf), lastUpd: Date.now()}, {merge:true});
    window.showToast("Notes saved.");
};

window.editProfileName = async () => {
    if(!state.user) return;
    const currentName = document.getElementById('prof-name').innerText;
    const newName = prompt("Enter your new display name:", currentName);
    if(!newName || newName.trim() === "" || newName.trim() === currentName) return;
    
    const clean = newName.trim();
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'roster', state.user.uid), { name: clean }, {merge:true});
    await setDoc(doc(db, 'artifacts', appId, 'users', state.user.uid, 'settings', 'profile'), { name: clean }, {merge:true});
    window.showToast("Display name updated!");
};