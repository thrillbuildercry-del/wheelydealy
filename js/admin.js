import { db, appId } from './firebase-config.js';
import { doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

window.initAdminDashboard = (user) => {
    document.getElementById('admin-app').classList.remove('hidden');
    window.switchAdminTab('storage');
    
    onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'roster', user.uid), (snap) => {
        if(snap.exists()) {
            window.adminData = { ...window.adminData, ...snap.data() };
            if(typeof window.admUpdateMasterLabels === 'function') window.admUpdateMasterLabels();
        }
    });

    onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'inventory', 'master'), (s) => {
        if(s.exists()) {
            window.masterData = { ...window.masterData, ...s.data() };
            if(typeof window.updateFinanceUI === 'function') window.updateFinanceUI();
        }
    });
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
    document.getElementById(`admin-view-${tab}`).classList.remove('hidden');
    document.getElementById(`admin-view-${tab}`).classList.add('active');
    document.getElementById(`adm-tab-${tab}`).classList.add('bg-gray-800', 'text-white', 'shadow');
};

// FEATURE: Online Status Rendering in Staff List
window.processAdminRosterUI = () => {
    const list = document.getElementById('admin-staff-list'); 
    if(!list) return;
    list.innerHTML=''; 
    
    window.globalRoster.forEach(u => {
        if(u.status !== 'pending') {
            // Online presence check
            const isOnline = u.lastActive && (Date.now() - u.lastActive < 3600000) && u.isOnline;
            const statusDot = isOnline ? 'active' : 'offline';
            const statusText = isOnline ? 'Online' : 'Offline';
            
            list.innerHTML += `
                <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer hover:border-blue-400 transition" onclick="window.viewDriverDetails('${u.id}')">
                    <div class="flex justify-between items-center mb-2">
                        <div class="font-bold dark:text-white flex items-center">
                            <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs mr-2 border border-blue-200">${u.name[0]}</div>
                            ${u.name}
                        </div>
                        <div class="flex flex-col items-end">
                            <div class="text-xs text-gray-500 flex items-center gap-1"><span class="online-dot ${statusDot}"></span> ${statusText}</div>
                            <div class="font-black dark:text-white mt-1">${u.role === 'admin' ? (u.soldWeight||0).toFixed(1) : (u.weight||0).toFixed(1)} u Held</div>
                        </div>
                    </div>
                </div>`;
        }
    });
};

// FEATURE: Editable Sales Modal
window.viewDriverDetails = (uid) => {
    window.currentDetailUid = uid;
    const staff = window.globalRoster.find(u => u.id === uid);
    document.getElementById('detail-user-name').innerText = staff.name;
    document.getElementById('admin-user-detail').classList.remove('hidden');

    const ctx = document.getElementById('adminDetailChart');
    const listContainer = document.createElement('div');
    listContainer.className = "mt-4 space-y-2";
    
    // Add Editable log to Detail view
    if(staff.transactions) {
        staff.transactions.slice(-20).reverse().forEach(t => {
            if(t.type === 'sale') {
                const adjHtml = t.note ? `<div class="text-[10px] text-red-500 italic mt-1 w-full">Note: ${t.note}</div>` : '';
                listContainer.innerHTML += `
                    <div class="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg flex flex-wrap justify-between items-center border border-gray-200 dark:border-gray-600 text-sm">
                        <div>
                            <div class="font-bold dark:text-white">Sold ${t.qty} ${t.unitType}</div>
                            <div class="text-green-600 font-black">$${t.money} <span class="text-xs text-gray-500 font-normal ml-1">(Exp: $${t.expected})</span></div>
                        </div>
                        <button onclick="window.openEditSaleModal('${uid}', ${t.id})" class="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 btn-interactive text-xs font-bold flex items-center"><i data-lucide="edit" class="w-3 h-3 mr-1"></i> Edit</button>
                        ${adjHtml}
                    </div>`;
            }
        });
    }
    
    const existingLog = document.getElementById('admin-editable-logs');
    if(existingLog) existingLog.remove();
    listContainer.id = 'admin-editable-logs';
    document.querySelector('#admin-user-detail .p-4').appendChild(listContainer);
    if(typeof lucide !== 'undefined') lucide.createIcons();
};

window.openEditSaleModal = (uid, transId) => {
    const staff = window.globalRoster.find(u => u.id === uid);
    const trans = staff.transactions.find(t => t.id === transId);
    if(!trans) return;

    document.getElementById('edit-sale-uid').value = uid;
    document.getElementById('edit-sale-id').value = transId;
    document.getElementById('edit-sale-qty').value = trans.qty;
    document.getElementById('edit-sale-money').value = trans.money;
    
    document.getElementById('edit-sale-modal').classList.remove('hidden');
};

window.saveEditedSale = async () => {
    const uid = document.getElementById('edit-sale-uid').value;
    const transId = parseInt(document.getElementById('edit-sale-id').value);
    const newQty = parseFloat(document.getElementById('edit-sale-qty').value);
    const newMoney = parseFloat(document.getElementById('edit-sale-money').value);

    const staff = window.globalRoster.find(u => u.id === uid);
    const transIndex = staff.transactions.findIndex(t => t.id === transId);
    const oldTrans = staff.transactions[transIndex];

    // Reversal Logic
    const oldExpected = oldTrans.expected;
    const oldMoney = oldTrans.money;
    const oldWeight = oldTrans.weightUsed;

    // Apply New
    const newExpected = oldTrans.unitType === 'full' ? newQty * (window.masterData.pricePerUnit || 100) : newQty * (window.masterData.pricePerUnit || 100) * (window.masterData.usualRatio || 0.8);
    const newWeight = oldTrans.unitType === 'full' ? newQty * 1.0 : newQty * (window.masterData.usualRatio || 0.8);

    // Calculate Diff
    const diffCollected = newMoney - oldMoney;
    const diffExpected = newExpected - oldExpected;
    const diffWeightUsed = newWeight - oldWeight;

    // Update Transaction object
    const newTransList = [...staff.transactions];
    newTransList[transIndex] = { ...oldTrans, qty: newQty, money: newMoney, expected: newExpected, weightUsed: newWeight, note: "Edited by Admin" };

    let updatePayload = {
        collected: window.increment(diffCollected),
        expected: window.increment(diffExpected),
        soldWeight: window.increment(diffWeightUsed),
        transactions: newTransList
    };

    // Fix Staff Inventory
    if(oldTrans.source === 'raw') updatePayload.weight = window.increment(-diffWeightUsed);
    else if(oldTrans.unitType === 'full') {
        updatePayload.unitsFull = window.increment(oldTrans.qty - newQty);
        updatePayload.soldUnitsFull = window.increment(newQty - oldTrans.qty);
    }
    else {
        updatePayload.unitsUsual = window.increment(oldTrans.qty - newQty);
        updatePayload.soldUnitsUsual = window.increment(newQty - oldTrans.qty);
    }

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'roster', uid), updatePayload, {merge:true});
    document.getElementById('edit-sale-modal').classList.add('hidden');
    window.showToast("Sale successfully updated!");
    window.viewDriverDetails(uid); // refresh
};