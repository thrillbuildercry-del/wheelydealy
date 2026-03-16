import { doc, setDoc, getDoc, updateDoc, deleteDoc, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, appId } from "./firebase-config.js";
import { state } from "./state.js";

// Helper to get correct master field based on active tab
const getMF = (base) => `${base}_${state.currentDept}`; 
const getAF = (base) => `${base}_${state.currentDept}`; 

// ============================================================================
// VAULT & INVENTORY ADJUSTMENTS
// ============================================================================

window.adminDirectEdit = async (baseField, label) => {
    // Only Master Admins should edit directly
    if (state.userRole !== 'admin') return window.showToast("Only Master Admins can edit inventory directly.");
    
    // Map 'rawWeight', 'unitsFull', 'unitsUsual' to the active department
    const actualField = getMF(baseField);
    const current = state.masterData[actualField] || 0;
    
    const val = prompt(`Edit ${state.currentDept.toUpperCase()} ${label}:\nCurrent value is ${current}. Enter new EXACT value:`, current);
    if (val !== null && val.trim() !== "") {
        const num = parseFloat(val);
        if (!isNaN(num) && num >= 0) {
            await setDoc(doc(db,'artifacts',appId,'public','data','inventory','master'), {[actualField]: num}, {merge:true});
            window.showToast(`${state.currentDept.toUpperCase()} ${label} updated to ${num}`);
        } else {
            window.showToast("Invalid number entered.");
        }
    }
};

window.saveInventoryAdjustment = async () => {
    const baseType = document.getElementById('adj-item-type').value; // 'rawWeight', 'unitsFull', 'unitsUsual'
    const actualField = getMF(baseType);
    const action = document.getElementById('adj-action').value;
    const amt = parseFloat(document.getElementById('adj-amt').value);
    
    if(isNaN(amt) || amt < 0) return window.showToast("Enter a valid amount.");

    let currentVal = state.masterData[actualField] || 0;
    let newVal = currentVal;

    if(action === 'add') newVal += amt;
    else if(action === 'remove') newVal = Math.max(0, currentVal - amt);
    else if(action === 'set') newVal = amt;

    await setDoc(doc(db,'artifacts',appId,'public','data','inventory','master'), { [actualField]: newVal }, {merge:true});
    
    document.getElementById('admin-adjust-modal').classList.add('hidden');
    document.getElementById('adj-amt').value = '';
    window.showToast(`Inventory updated: ${state.currentDept.toUpperCase()} ${baseType} is now ${newVal.toFixed(1)}`);
};

window.adminProcessUnits = async () => {
    const type = document.getElementById('process-type').value; // 'full' or 'usual'
    const qty = parseFloat(document.getElementById('process-qty').value);
    if (isNaN(qty) || qty <= 0) return window.showToast("Enter valid quantity.");
    
    const ratio = state.masterData[getMF('usualRatio')] || 0.8;
    const rawNeeded = type === 'full' ? qty * 1.0 : qty * ratio;
    
    const rawField = getMF('rawWeight');
    const unitField = type === 'full' ? getMF('unitsFull') : getMF('unitsUsual');

    if ((state.masterData[rawField] || 0) < rawNeeded) return window.showToast(`Not enough ${state.currentDept.toUpperCase()} raw weight in Vault!`);

    let updateObj = { [rawField]: increment(-rawNeeded), [unitField]: increment(qty) };

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventory', 'master'), updateObj, {merge:true});
    document.getElementById('process-qty').value = '';
    window.showToast(`Processed ${qty} ${type} units in ${state.currentDept.toUpperCase()} department.`);
};

window.adminPurchaseStock = async (amount, cost) => {
    if(cost === 0) {
        const cAmt = parseFloat(prompt(`Enter amount of ${state.currentDept.toUpperCase()} units purchased:`));
        const cCost = parseFloat(prompt("Enter cost in dollars ($):"));
        if(isNaN(cAmt) || isNaN(cCost)) return;
        amount = cAmt; cost = cCost;
    } else {
        if(!confirm(`Buy ${amount} ${state.currentDept.toUpperCase()} units for $${cost}? This will deduct from Master Cash.`)) return;
    }
    
    const rawField = getMF('rawWeight');

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventory', 'master'), {
        [rawField]: increment(amount),
        cashBalance: increment(-cost),
        totalExpenses: increment(cost)
    }, {merge:true});
    
    window.showToast(`Purchased ${amount} ${state.currentDept.toUpperCase()} units. $${cost} deducted from Cash.`);
};

// ============================================================================
// TRANSFERS & ACTION REQUESTS
// ============================================================================

window.updateTransferPreview = () => {
    const staffId = document.getElementById('transfer-staff-select').value;
    const type = document.getElementById('transfer-item-type').value; // 'raw', 'full', 'usual'
    const preview = document.getElementById('transfer-preview');
    if(!preview) return;
    
    if(!staffId) { preview.innerText = ''; return; }
    const staff = state.globalRoster.find(u => u.id === staffId);
    if(!staff) return;
    
    // Map type to dynamic department fields
    const baseStaffField = type === 'raw' ? 'weight' : (type === 'full' ? 'unitsFull' : 'unitsUsual');
    const baseMasterField = type === 'raw' ? 'rawWeight' : (type === 'full' ? 'unitsFull' : 'unitsUsual');
    
    const sField = getAF(baseStaffField);
    const mField = getMF(baseMasterField);

    preview.innerHTML = `[${state.currentDept.toUpperCase()}] Staff holds: <span class="font-bold text-gray-800 dark:text-white">${staff[sField]||0}</span> | Vault holds: <span class="font-bold text-gray-800 dark:text-white">${state.masterData[mField]||0}</span>`;
};

window.adminTransferWeight = async (direction) => {
    const staffId = document.getElementById('transfer-staff-select').value;
    const type = document.getElementById('transfer-item-type').value;
    const amt = parseFloat(document.getElementById('transfer-amount').value);
    
    if(!staffId || isNaN(amt) || amt <= 0) return window.showToast("Invalid input.");
    const staff = state.globalRoster.find(u => u.id === staffId);
    if(!staff) return;

    const baseStaffField = type === 'raw' ? 'weight' : (type === 'full' ? 'unitsFull' : 'unitsUsual');
    const baseMasterField = type === 'raw' ? 'rawWeight' : (type === 'full' ? 'unitsFull' : 'unitsUsual');
    
    const sField = getAF(baseStaffField);
    const mField = getMF(baseMasterField);

    if(direction === 'send') {
        if((state.masterData[mField] || 0) < amt) return window.showToast("Not enough in Master Vault!");
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventory', 'master'), { [mField]: increment(-amt) }, {merge:true});
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'roster', staffId), { [sField]: increment(amt) }, {merge:true});
        
        // Also update staff app_state directly so they see it instantly without refreshing
        try {
            const snap = await getDoc(doc(db, 'artifacts', appId, 'users', staffId, 'data', 'app_state'));
            if (snap.exists()) {
                let st = JSON.parse(snap.data().json);
                st[sField] = (st[sField] || 0) + amt;
                await setDoc(doc(db, 'artifacts', appId, 'users', staffId, 'data', 'app_state'), { json: JSON.stringify(st), lastUpdated: Date.now() }, {merge: true});
            }
        } catch(e) {}

        window.showToast(`Sent ${amt} ${state.currentDept.toUpperCase()} to ${staff.name}.`);
    } else {
        if((staff[sField] || 0) < amt) return window.showToast(`${staff.name} doesn't have enough!`);
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'roster', staffId), { [sField]: increment(-amt) }, {merge:true});
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventory', 'master'), { [mField]: increment(amt) }, {merge:true});
        
        try {
            const snap = await getDoc(doc(db, 'artifacts', appId, 'users', staffId, 'data', 'app_state'));
            if (snap.exists()) {
                let st = JSON.parse(snap.data().json);
                st[sField] = (st[sField] || 0) - amt;
                await setDoc(doc(db, 'artifacts', appId, 'users', staffId, 'data', 'app_state'), { json: JSON.stringify(st), lastUpdated: Date.now() }, {merge: true});
            }
        } catch(e) {}

        window.showToast(`Reclaimed ${amt} ${state.currentDept.toUpperCase()} from ${staff.name}.`);
    }
    
    document.getElementById('transfer-amount').value = '';
    window.updateTransferPreview();
};

window.adminHandleRequest = async (reqId, action, type) => {
    const reqRef = doc(db, 'artifacts', appId, 'public', 'data', 'requests', reqId);
    const snap = await getDoc(reqRef);
    if(!snap.exists()) return;
    const req = snap.data();

    if(action === 'deny') {
        await updateDoc(reqRef, { status: 'denied' });
        window.showToast("Request denied.");
        return;
    }

    if(type === 'bill' || type === 'bill_request') {
        document.getElementById('bill-name').value = req.desc;
        document.getElementById('bill-amt').value = req.amount;
        document.getElementById('bill-request-id').value = reqId;
        document.getElementById('admin-bill-modal').classList.remove('hidden');
    } else if (type === 'iou' || type === 'iou_request') {
        document.getElementById('iou-name').value = req.clientName;
        document.getElementById('iou-contact').value = req.contact || '';
        document.getElementById('iou-qty').value = req.qty;
        document.getElementById('iou-type').value = req.iouType;
        document.getElementById('iou-amt').value = req.amount;
        document.getElementById('iou-request-id').value = reqId;
        document.getElementById('admin-iou-modal').classList.remove('hidden');
    } else if (type === 'inventory' || type === 'weight') {
        document.getElementById('transfer-staff-select').value = req.staffId || req.uid;
        window.switchAdminTab('transfers');
        await updateDoc(reqRef, { status: 'approved' });
        window.showToast("Switched to transfer tab. Fulfill request there.");
    }
};

// ============================================================================
// BILLS & MASTER FINANCE UI
// ============================================================================

window.adminSetVariable = async (baseField, label) => { 
    // Handle switching between Soft/Hard custom pricing variables dynamically
    let targetField = baseField;
    if(baseField === 'pricePerUnit' || baseField === 'usualRatio') targetField = getMF(baseField);

    const v = prompt(`Set ${state.currentDept.toUpperCase()} ${label}:`, state.masterData[targetField]); 
    if(v && !isNaN(v)) {
        await setDoc(doc(db,'artifacts',appId,'public','data','inventory','master'),{[targetField]: parseFloat(v)},{merge:true}); 
    }
};

window.adminUpdateCash = async () => {
    const current = state.masterData.cashBalance || 0;
    const amt = parseFloat(prompt(`Current Master Cash: $${current}\n\nEnter amount to add/subtract (use negative number to subtract):`, "0"));
    if(isNaN(amt)) return; 
    await setDoc(doc(db,'artifacts',appId,'public','data','inventory','master'), { cashBalance: increment(amt) }, {merge:true});
};

window.updateFinanceUI = () => {
    if (!document.getElementById('admin-view-finance')) return;
    
    // Calculate global active inventory value dynamically based on department
    let staffFull = 0, staffUsual = 0;
    state.globalRoster.forEach(u => { 
        if (u.role !== 'admin') { 
            staffFull += (u[getAF('unitsFull')] || 0); 
            staffUsual += (u[getAF('unitsUsual')] || 0); 
        } 
    });
    
    const totalFull = (state.masterData[getMF('unitsFull')] || 0) + staffFull; 
    const totalUsual = (state.masterData[getMF('unitsUsual')] || 0) + staffUsual;
    
    document.getElementById('proj-full-count').innerText = totalFull; 
    document.getElementById('proj-usual-count').innerText = totalUsual;
    
    const priceFull = state.masterData[getMF('pricePerUnit')] || 100; 
    const priceUsual = priceFull * (state.masterData[getMF('usualRatio')] || 0.8);
    
    const totalProjStd = (totalFull * priceFull) + (totalUsual * priceUsual); 
    const totalWhatIf = (totalFull * priceFull) + (totalUsual * priceFull); 
    
    const stdEl = document.getElementById('proj-std-total');
    const oldStdStr = stdEl ? stdEl.innerText.replace(/[$,]/g, '') : '0';
    const whatIfEl = document.getElementById('proj-whatif-total');
    const oldWhatIfStr = whatIfEl ? whatIfEl.innerText.replace(/[$,]/g, '') : '0';
    
    window.animateValue('proj-std-total', parseFloat(oldStdStr)||0, totalProjStd, 600, '$', true);
    window.animateValue('proj-whatif-total', parseFloat(oldWhatIfStr)||0, totalWhatIf, 600, '$', true);
    
    // Re-render the Bills/Liabilities list
    const liabList = document.getElementById('finance-liabilities-list'); 
    if (liabList) {
        liabList.innerHTML = ''; 
        let unpaidTotal = 0;
        
        if (state.masterData.liabilities && state.masterData.liabilities.length > 0) {
            state.masterData.liabilities.forEach(l => {
                if(!l.isPaid) unpaidTotal += l.amount;
                const recurringBadge = l.isRecurring ? `<span class="bg-blue-100 text-blue-600 text-[9px] px-1.5 py-0.5 rounded ml-2 uppercase tracking-wide">Recurring</span>` : '';
                const dateDisplay = l.dueDate ? `<div class="text-[10px] text-gray-500 mt-1">Due: ${new Date(l.dueDate).toLocaleDateString()}</div>` : '';
                liabList.innerHTML += `
                    <div class="flex justify-between items-center p-3 rounded-lg border ${l.isPaid ? 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700 opacity-60' : 'bg-white border-purple-200 dark:bg-gray-700 dark:border-purple-800'} shadow-sm">
                        <div class="flex items-start">
                            <input type="checkbox" ${l.isPaid ? 'checked' : ''} onchange="window.adminToggleLiability(${l.id})" class="w-4 h-4 mr-3 mt-1 accent-purple-600 cursor-pointer">
                            <div>
                                <span class="font-bold ${l.isPaid ? 'line-through text-gray-400' : 'dark:text-white'} text-sm">${l.name} ${recurringBadge}</span>
                                ${dateDisplay}
                            </div>
                        </div>
                        <div class="flex items-center">
                            <span class="font-black ${l.isPaid ? 'text-gray-400' : 'text-purple-600 dark:text-purple-400'} mr-3">$${l.amount.toFixed(2)}</span>
                            <button onclick="window.adminRemoveLiability(${l.id})" class="text-red-400 hover:text-red-600"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        </div>
                    </div>`;
            });
        } else { 
            liabList.innerHTML = '<div class="text-center py-4 text-xs text-gray-400 italic">No priorities added yet.</div>'; 
        }
        
        document.getElementById('finance-unpaid-total').innerText = `-$${unpaidTotal.toFixed(2)}`;
        const netAfterBills = (state.masterData.cashBalance || 0) - unpaidTotal;
        
        const netEl = document.getElementById('finance-net-after-bills');
        if (netEl) {
            const oldNetStr = netEl.innerText.replace(/[$,]/g, '');
            window.animateValue('finance-net-after-bills', parseFloat(oldNetStr)||0, netAfterBills, 500, '$', true);
            
            if(netAfterBills < 0) {
                netEl.classList.remove('text-green-600');
                netEl.classList.add('text-red-500'); 
            } else {
                netEl.classList.remove('text-red-500');
                netEl.classList.add('text-green-600');
            }
        }
    }
    if(typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
};

window.saveAdminBill = async () => {
    const name = document.getElementById('bill-name').value;
    const amt = parseFloat(document.getElementById('bill-amt').value);
    const date = document.getElementById('bill-date').value;
    const recur = document.getElementById('bill-recurring').checked;
    const reqId = document.getElementById('bill-request-id').value;

    if(!name || isNaN(amt)) return window.showToast("Enter bill name and amount.");

    const liabilities = state.masterData.liabilities || [];
    liabilities.push({ id: Date.now(), name, amount: amt, dueDate: date, isRecurring: recur, isPaid: false });
    
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventory', 'master'), { liabilities }, {merge:true});
    
    if(reqId) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'requests', reqId), { status: 'approved' });
        document.getElementById('bill-request-id').value = '';
    }
    
    document.getElementById('admin-bill-modal').classList.add('hidden');
    document.getElementById('bill-name').value = '';
    document.getElementById('bill-amt').value = '';
    window.showToast("Bill added successfully.");
};

window.adminToggleLiability = async (id) => {
    let deduction = 0;
    const liabilities = (state.masterData.liabilities || []).map(l => {
        if (l.id === id) {
            const willBePaid = !l.isPaid;
            if(willBePaid) deduction = l.amount; 
            else deduction = -l.amount; 
            return { ...l, isPaid: willBePaid };
        }
        return l;
    });
    
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventory', 'master'), { 
        liabilities, cashBalance: increment(-deduction) 
    }, {merge:true});
    
    if(deduction > 0) window.showToast(`$${deduction} deducted from Master Cash to pay bill.`);
};

window.adminRemoveLiability = async (id) => {
    if(!confirm("Remove this bill entirely?")) return;
    const liabilities = (state.masterData.liabilities || []).filter(l => l.id !== id);
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventory', 'master'), { liabilities }, {merge:true});
};

// ============================================================================
// IOU / FINANCED CLIENTS
// ============================================================================

window.updateIOUUI = () => {
    if(!document.getElementById('admin-view-ious')) return;
    const list = document.getElementById('iou-list');
    if(!list) return;
    list.innerHTML = '';
    
    let totalOwed = 0;
    if(state.masterData.financedClients && state.masterData.financedClients.length > 0) {
        state.masterData.financedClients.forEach(c => {
            if(!c.isPaid) totalOwed += c.amount;
            const dateDisplay = c.payDate ? `<div class="text-[10px] text-gray-500 mt-1">Pay Date: ${new Date(c.payDate).toLocaleDateString()}</div>` : '';
            
            list.innerHTML += `
                <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border ${c.isPaid ? 'border-green-200 dark:border-green-800 opacity-60' : 'border-blue-200 dark:border-blue-800'} mb-3 transition">
                    <div class="flex justify-between items-start mb-2 border-b dark:border-gray-700 pb-2">
                        <div>
                            <h4 class="font-bold dark:text-white ${c.isPaid ? 'line-through text-gray-400' : ''}">${c.name}</h4>
                            <div class="text-xs text-gray-500">${c.contact || 'No contact provided'}</div>
                            ${dateDisplay}
                        </div>
                        <div class="text-right">
                            <div class="text-2xl font-black ${c.isPaid ? 'text-green-500' : 'text-blue-600 dark:text-blue-400'}">$${c.amount.toFixed(2)}</div>
                            <div class="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded font-bold uppercase inline-block mt-1">${c.qty} ${c.type}</div>
                        </div>
                    </div>
                    <div class="flex justify-between items-center pt-1">
                        <label class="flex items-center text-xs font-bold text-gray-600 dark:text-gray-400 cursor-pointer">
                            <input type="checkbox" ${c.isPaid ? 'checked' : ''} onchange="window.adminToggleIOU(${c.id})" class="w-4 h-4 mr-2 accent-blue-600"> 
                            ${c.isPaid ? 'Marked Paid' : 'Mark as Paid'}
                        </label>
                        <div class="space-x-2">
                            <button onclick="window.adminEditIOU(${c.id})" class="text-gray-400 hover:text-blue-500 btn-interactive"><i data-lucide="edit" class="w-4 h-4"></i></button>
                            <button onclick="window.adminRemoveIOU(${c.id})" class="text-red-400 hover:text-red-600 btn-interactive"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        </div>
                    </div>
                </div>`;
        });
    } else {
        list.innerHTML = '<div class="text-center py-6 text-xs text-gray-400 italic">No financed clients active.</div>';
    }
    
    const totEl = document.getElementById('iou-total-owed');
    if(totEl) {
        const oldVal = parseFloat(totEl.innerText.replace(/[$,]/g, '')) || 0;
        window.animateValue('iou-total-owed', oldVal, totalOwed, 500, '$', true);
    }
    if(typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
};

window.saveAdminIOU = async () => {
    const name = document.getElementById('iou-name').value;
    const contact = document.getElementById('iou-contact').value;
    const qty = parseFloat(document.getElementById('iou-qty').value);
    const type = document.getElementById('iou-type').value;
    const amt = parseFloat(document.getElementById('iou-amt').value);
    const date = document.getElementById('iou-date').value;
    const reqId = document.getElementById('iou-request-id').value;
    const editId = document.getElementById('iou-edit-id').value;

    if(!name || isNaN(qty) || isNaN(amt)) return window.showToast("Fill required client details!");

    let clients = state.masterData.financedClients || [];
    let masterUpdate = {};
    
    if (editId) {
        clients = clients.map(c => c.id == editId ? { ...c, name, contact, qty, type, amount: amt, payDate: date } : c);
    } else {
        clients.push({ id: Date.now(), name, contact, qty, type, amount: amt, payDate: date, isPaid: false });
        
        // Dynamically deduct inventory based on current department
        const rawField = getMF('rawWeight');
        const fullField = getMF('unitsFull');
        const usualField = getMF('unitsUsual');

        if (type === 'raw') masterUpdate[rawField] = increment(-qty);
        if (type === 'full') masterUpdate[fullField] = increment(-qty);
        if (type === 'usual') masterUpdate[usualField] = increment(-qty);
    }

    masterUpdate.financedClients = clients;

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventory', 'master'), masterUpdate, {merge:true});

    if(reqId) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'requests', reqId), { status: 'approved' });
    }

    document.getElementById('admin-iou-modal').classList.add('hidden');
    window.showToast(editId ? "Client IOU Updated!" : "Client IOU Logged!");
    
    ['iou-name', 'iou-contact', 'iou-qty', 'iou-amt', 'iou-date', 'iou-edit-id', 'iou-request-id'].forEach(id => document.getElementById(id).value = '');
};

window.adminEditIOU = (id) => {
    const client = (state.masterData.financedClients || []).find(c => c.id == id);
    if(!client) return;
    document.getElementById('iou-name').value = client.name;
    document.getElementById('iou-contact').value = client.contact || '';
    document.getElementById('iou-qty').value = client.qty;
    document.getElementById('iou-type').value = client.type;
    document.getElementById('iou-amt').value = client.amount;
    document.getElementById('iou-date').value = client.payDate || '';
    document.getElementById('iou-edit-id').value = client.id;
    document.getElementById('admin-iou-modal').classList.remove('hidden');
};

window.adminToggleIOU = async (id) => {
    let cashAdjustment = 0;
    const clients = (state.masterData.financedClients || []).map(c => {
        if (c.id === id) {
            const willBePaid = !c.isPaid;
            cashAdjustment = willBePaid ? c.amount : -c.amount;
            if (willBePaid) window.showToast(`$${c.amount} added to Master Cash Balance.`);
            else window.showToast(`$${c.amount} removed from Master Cash Balance.`);
            return { ...c, isPaid: willBePaid };
        }
        return c;
    });

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventory', 'master'), { 
        financedClients: clients, cashBalance: increment(cashAdjustment)
    }, {merge:true});
};

window.adminRemoveIOU = async (id) => {
    if(!confirm("Delete this IOU? It will not refund inventory.")) return;
    const clients = (state.masterData.financedClients || []).filter(c => c.id !== id);
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventory', 'master'), { financedClients: clients }, {merge:true});
};

// ============================================================================
// GLOBAL ANALYTICS LOGIC (Shared between files)
// ============================================================================
window.calculateAnalytics = (transactions) => {
    const now = Date.now();
    const periods = [
        { label: 'Today', ms: 86400000 }, 
        { label: '7 Days', ms: 604800000 }, 
        { label: '30 Days', ms: 2592000000 }
    ];
    let stats = periods.map(p => ({ label: p.label, pieces: 0, revenue: 0, expenses: 0, profit: 0 }));
    
    transactions.forEach(t => {
        // Filter out transactions that do not belong to the current active department tab
        if (t.dept && t.dept !== state.currentDept) return;

        const age = now - t.id;
        periods.forEach((p, index) => {
            if (age <= p.ms) {
                if (t.type === 'expense') {
                    stats[index].expenses += Math.abs(t.money);
                } else if (t.type !== 'personal' && t.type !== 'borrowing' && t.type !== 'dropoff') { 
                    stats[index].revenue += (t.money || 0); 
                    stats[index].pieces += (t.qty || 0); 
                }
            }
        });
    });
    stats.forEach(s => s.profit = s.revenue - s.expenses);
    return stats;
};

window.loadGlobalAnalytics = async () => {
    let allTx = []; 
    if(state.adminData && state.adminData.transactions) allTx.push(...state.adminData.transactions);
    
    for(const u of state.globalRoster) {
        if(u.role !== 'admin') {
            try { 
                const snap = await getDoc(doc(db, 'artifacts', appId, 'users', u.id, 'data', 'app_state')); 
                if(snap.exists()) { 
                    const dat = JSON.parse(snap.data().json); 
                    if(dat.transactions) allTx.push(...dat.transactions); 
                } 
            } catch(e) {}
        }
    }
    
    const stats = window.calculateAnalytics(allTx);
    document.getElementById('admin-pieces-today').innerText = stats[0].pieces; 
    document.getElementById('admin-pieces-week').innerText = stats[1].pieces; 
    document.getElementById('admin-pieces-month').innerText = stats[2].pieces;
    
    const ctx = document.getElementById('adminProfitChart'); 
    if(!ctx) return;
    
    if(state.charts.adminProfit) state.charts.adminProfit.destroy();
    state.charts.adminProfit = new Chart(ctx, { 
        type: 'bar', 
        data: { 
            labels: stats.map(s => s.label), 
            datasets: [
                { label: 'Gross Rev ($)', data: stats.map(s => s.revenue), backgroundColor: '#22c55e', borderRadius: 4, yAxisID: 'y' }, 
                { label: 'Costs/Exp ($)', data: stats.map(s => s.expenses), backgroundColor: '#ef4444', borderRadius: 4, yAxisID: 'y' }, 
                { label: 'Net Earnings ($)', data: stats.map(s => s.profit), backgroundColor: '#8b5cf6', borderRadius: 4, yAxisID: 'y' },
                { label: 'Pieces Sold', data: stats.map(s => s.pieces), type: 'line', borderColor: '#f59e0b', backgroundColor: '#f59e0b', borderWidth: 2, tension: 0.1, yAxisID: 'y1' }
            ] 
        }, 
        options: { 
            responsive: true, maintainAspectRatio: false, 
            plugins: { 
                legend: { position: 'bottom', labels: { boxWidth: 10, font: {size: 10} } }
            }, 
            scales: { 
                y: { beginAtZero: true, position: 'left' },
                y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false } }
            } 
        } 
    });
};

window.adminFactoryReset = async () => {
    if(!confirm("DANGER: This wipes ALL inventory, sales, money, expected, and collected data to ZERO for you and ALL staff. Accounts will remain. Type 'YES' to confirm.")) return;
    const typed = prompt("Type 'YES' to confirm total wipe:");
    if(typed !== "YES") return window.showToast("Reset Cancelled.");
    
    await setDoc(doc(db,'artifacts',appId,'public','data','inventory','master'), { 
        rawWeight_soft: 0, unitsFull_soft: 0, unitsUsual_soft: 0, 
        rawWeight_hard: 0, unitsFull_hard: 0, unitsUsual_hard: 0, 
        totalExpenses: 0, cashBalance: 0, liabilities: [], financedClients: []
    }, {merge:true});
    
    state.adminData = { ...state.adminData, soldWeight_soft:0, soldUnitsFull_soft:0, soldUnitsUsual_soft:0, soldWeight_hard:0, soldUnitsFull_hard:0, soldUnitsUsual_hard:0, personalUseWeight:0, personalUseOwed:0, collected:0, expected:0, expenses:0, cashDropped:0, borrowings:0, transactions:[] };
    await window.saveAdminData();

    for(const u of state.globalRoster) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'roster', u.id), { 
            weight_soft:0, unitsFull_soft:0, unitsUsual_soft:0, soldWeight_soft:0, soldUnitsFull_soft:0, soldUnitsUsual_soft:0, 
            weight_hard:0, unitsFull_hard:0, unitsUsual_hard:0, soldWeight_hard:0, soldUnitsFull_hard:0, soldUnitsUsual_hard:0, 
            personalUseWeight:0, personalUseOwed:0, borrowings:0, cashDropped:0, collected:0, expected:0, expenses:0, recentLogs:[] 
        }, {merge:true});
        
        try {
            const snap = await getDoc(doc(db, 'artifacts', appId, 'users', u.id, 'data', 'app_state'));
            if(snap.exists()) {
                let st = JSON.parse(snap.data().json);
                st = { ...st, weight_soft:0, unitsFull_soft:0, unitsUsual_soft:0, soldWeight_soft:0, soldUnitsFull_soft:0, soldUnitsUsual_soft:0, weight_hard:0, unitsFull_hard:0, unitsUsual_hard:0, soldWeight_hard:0, soldUnitsFull_hard:0, soldUnitsUsual_hard:0, personalUseWeight:0, personalUseOwed:0, borrowings:0, cashDropped:0, collected:0, expected:0, expenses:0, transactions:[] };
                await setDoc(doc(db, 'artifacts', appId, 'users', u.id, 'data', 'app_state'), { json: JSON.stringify(st), lastUpdated: Date.now() });
            }
        } catch(e){}
    }
    
    document.getElementById('settings-modal').classList.add('hidden');
    window.showToast("Factory Reset Complete.");
};