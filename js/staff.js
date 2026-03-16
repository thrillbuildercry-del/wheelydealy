import { db, appId } from './firebase-config.js';
import { doc, setDoc, increment, collection, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

window.currentQty = 1; 
window.currentType = 'full';

window.initStaffApp = (user) => {
    document.getElementById('staff-app').classList.remove('hidden');
    onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'roster', user.uid), (snap) => {
        if(snap.exists()) {
            window.appData = { ...window.appData, ...snap.data() };
            window.updateStaffUI();
            if(typeof window.renderStaffChart === 'function') window.renderStaffChart();
        }
    });
};

window.selectQty = (q) => { 
    window.currentQty = q; 
    document.querySelectorAll('.qty-btn').forEach(b => b.classList.remove('active')); 
    document.getElementById(`btn-qty-${q}`).classList.add('active'); 
    if(typeof window.updateMasterLabels === 'function') window.updateMasterLabels(); 
};

window.selectType = (t) => { 
    window.currentType = t; 
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active')); 
    document.getElementById(`btn-type-${t}`).classList.add('active'); 
    if(typeof window.updateMasterLabels === 'function') window.updateMasterLabels(); 
};

// FEATURE: Price Adjustments
window.checkPriceColor = () => {
    const input = document.getElementById('money-input');
    const noteContainer = document.getElementById('sale-note-container');
    const val = parseFloat(input.value) || 0;
    const expected = window.currentType === 'full' ? (window.currentQty * (window.masterData.pricePerUnit||100)) : (window.currentQty * (window.masterData.pricePerUnit||100) * (window.masterData.usualRatio||0.8));
    
    if(val === 0) {
        input.className = input.className.replace(/text-(green|red)-500/, '') + ' text-gray-800 dark:text-white';
        noteContainer.classList.add('hidden');
    }
    else if(val < expected) {
        input.className = input.className.replace(/text-gray-800|dark:text-white|text-green-500/, '') + ' text-red-500';
        noteContainer.classList.remove('hidden'); // Show adjustment note
    }
    else {
        input.className = input.className.replace(/text-gray-800|dark:text-white|text-red-500/, '') + ' text-green-500';
        if(val > expected) noteContainer.classList.remove('hidden'); else noteContainer.classList.add('hidden');
    }
};

window.setQuickPrice = (amt) => { 
    document.getElementById('money-input').value = amt * window.currentQty; 
    window.checkPriceColor(); 
};

// Log Sale with Adjustments
window.processSale = async () => {
    if(window.currentQty <= 0) return window.showToast("Select quantity.");
    const moneyInput = document.getElementById('money-input').value;
    if(!moneyInput) return window.showToast("Enter money received.");
    const money = parseFloat(moneyInput);
    
    const source = document.getElementById('staff-sale-source').value;
    const exactWeight = window.currentType === 'full' ? window.currentQty * 1.0 : window.currentQty * (window.masterData.usualRatio || 0.8);
    const expected = window.currentType === 'full' ? window.currentQty * (window.masterData.pricePerUnit || 100) : window.currentQty * (window.masterData.pricePerUnit || 100) * (window.masterData.usualRatio || 0.8);

    // Grab the custom adjustment note if available
    const saleNote = document.getElementById('sale-note').value.trim();
    if(money !== expected && !saleNote) return window.showToast("Please provide a reason for the price adjustment.");

    let myUpdate = { soldWeight: increment(exactWeight), collected: increment(money), expected: increment(expected) };

    if(source === 'raw') {
        if(window.appData.weight < exactWeight) return window.showToast("Not enough Raw Weight!");
        myUpdate.weight = increment(-exactWeight);
    } else {
        if(window.currentType === 'full') {
            if(window.appData.unitsFull < window.currentQty) return window.showToast("Not enough Full Units!");
            myUpdate.unitsFull = increment(-window.currentQty);
        } else {
            if(window.appData.unitsUsual < window.currentQty) return window.showToast("Not enough Usual Units!");
            myUpdate.unitsUsual = increment(-window.currentQty);
        }
    }

    const trans = { 
        id: Date.now(), type: 'sale', qty: window.currentQty, unitType: window.currentType, source: source, 
        weightUsed: exactWeight, money, expected, date: new Date().toISOString(), note: saleNote 
    };
    myUpdate.transactions = [...window.appData.transactions, trans];

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'roster', window.currentUser.uid), myUpdate, {merge:true});

    document.getElementById('money-input').value = '';
    document.getElementById('sale-note').value = '';
    document.getElementById('sale-note-container').classList.add('hidden');
    window.checkPriceColor();
    window.showToast("Sale logged!");
    window.selectQty(1);
};

window.undoLastTransaction = async () => {
    if(!window.appData.transactions || window.appData.transactions.length === 0) return window.showToast("No transactions to undo.");
    const last = window.appData.transactions[window.appData.transactions.length - 1];
    if(!confirm(`Void last ${last.type} of ${last.qty || ''} units ($${last.money || last.owed || 0})?`)) return;

    let myUpdate = {};
    if(last.type === 'sale') {
        if(last.source === 'raw') myUpdate.weight = increment(last.weightUsed);
        else if(last.unitType === 'full') myUpdate.unitsFull = increment(last.qty);
        else myUpdate.unitsUsual = increment(last.qty);
        
        myUpdate.soldWeight = increment(-last.weightUsed);
        myUpdate.collected = increment(-last.money);
        myUpdate.expected = increment(-last.expected);
    } else if (last.type === 'expense') {
        myUpdate.expenses = increment(-last.money);
        myUpdate.collected = increment(last.money); 
    } 
    
    myUpdate.transactions = window.appData.transactions.slice(0, -1);
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'roster', window.currentUser.uid), myUpdate, {merge:true});
    window.showToast("Last transaction voided and reverted.");
};

window.updateStaffUI = () => {
    window.animateValue('staff-stock', parseFloat(document.getElementById('staff-stock').innerText), window.appData.weight, 400, '');
    document.getElementById('staff-stock-full').innerText = window.appData.unitsFull || 0;
    document.getElementById('staff-stock-usual').innerText = window.appData.unitsUsual || 0;
    
    const currentNet = window.appData.collected - window.appData.expenses - window.appData.cashDropped;
    window.animateValue('staff-stat-net', parseFloat(document.getElementById('staff-stat-net').innerText.replace('$','')), currentNet, 500, '$', true);
    
    const logList = document.getElementById('staff-log-list');
    logList.innerHTML = '';
    window.appData.transactions.slice(-15).reverse().forEach(t => {
        let text = ''; let color = 'text-gray-500'; let icon = 'circle';
        let adjBadge = t.note ? `<span class="ml-2 text-[8px] bg-red-100 text-red-600 px-1 rounded uppercase border border-red-200">Adjusted</span>` : '';
        
        if(t.type === 'sale') { text = `Sold ${t.qty} ${t.unitType} for $${t.money} ${adjBadge}`; color = 'text-green-500'; icon = 'check-circle'; }
        else if(t.type === 'expense') { text = `Expense: ${t.desc} ($${t.money})`; color = 'text-orange-500'; icon = 'fuel'; }
        else if(t.type === 'dropoff') { text = `Dropped off $${t.money}`; color = 'text-blue-500'; icon = 'hand-coins'; }
        
        let noteHtml = t.note ? `<div class="text-[9px] text-gray-400 ml-6 italic">Note: "${t.note}"</div>` : '';
        logList.innerHTML += `<div class="border-b dark:border-gray-700 py-2"><div class="flex items-center"><i data-lucide="${icon}" class="w-4 h-4 mr-2 ${color}"></i> <span>${text}</span></div>${noteHtml}</div>`;
    });
    if(typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
};