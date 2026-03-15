import { doc, setDoc, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, appId } from "./firebase-config.js";
import { state, getMF } from "./state.js";

window.adminProcessUnits = async () => {
    const type = document.getElementById('proc-type').value;
    const qty = parseFloat(document.getElementById('proc-qty').value);
    if (isNaN(qty) || qty <= 0) return window.showToast("Enter valid quantity.");
    
    const ratio = state.mst[getMF('usualRatio')] || 0.8;
    const rawNeeded = type === 'full' ? qty * 1.0 : qty * ratio;
    
    const rawField = getMF('rawWeight');
    const unitField = type === 'full' ? getMF('unitsFull') : getMF('unitsUsual');

    if ((state.mst[rawField] || 0) < rawNeeded) return window.showToast(`Not enough ${state.dept.toUpperCase()} raw weight in Vault!`);

    let updateObj = { [rawField]: increment(-rawNeeded), [unitField]: increment(qty) };

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventory', 'master'), updateObj, {merge:true});
    document.getElementById('proc-qty').value = '';
    window.showToast(`Processed ${qty} ${type} units.`);
};

window.adminFactoryReset = async () => {
    if(!confirm("WARNING: This will wipe ALL inventory, sales, cash balances, and liabilities to 0. User accounts will remain. Type 'RESET' to confirm.")) return;
    const promptVal = prompt("Type 'RESET' to confirm factory wipe:");
    if(promptVal !== 'RESET') return window.showToast("Factory reset cancelled.");
    
    await setDoc(doc(db,'artifacts',appId,'public','data','inventory','master'), {
        rawWeight_soft: 0, unitsFull_soft: 0, unitsUsual_soft: 0, 
        rawWeight_hard: 0, unitsFull_hard: 0, unitsUsual_hard: 0,
        totalExpenses: 0, cashBalance: 0, liabilities: [], financedClients: []
    }, {merge:true});
    
    for(let u of state.roster) {
        if(u.role !== 'admin') {
            await setDoc(doc(db,'artifacts',appId,'public','data','roster',u.id), {
                weight_soft: 0, unitsFull_soft: 0, unitsUsual_soft: 0, soldWeight_soft: 0, soldUnitsFull_soft: 0, soldUnitsUsual_soft: 0,
                weight_hard: 0, unitsFull_hard: 0, unitsUsual_hard: 0, soldWeight_hard: 0, soldUnitsFull_hard: 0, soldUnitsUsual_hard: 0,
                personalUseWeight: 0, personalUseOwed: 0, expected: 0, collected: 0, expenses: 0, borrowings: 0, cashDropped: 0, transactions: []
            }, {merge:true});
        }
    }
    window.showToast("FACTORY RESET COMPLETE");
};