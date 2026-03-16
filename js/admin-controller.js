import { db, appId } from './firebase-config.js';
import { doc, setDoc, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Factory Reset Logic
export const adminFactoryReset = async (globalRoster) => {
    if(!confirm("WARNING: This will wipe ALL inventory, sales, and balances to 0. Type 'RESET' to confirm.")) return;
    const promptVal = prompt("Type 'RESET' to confirm factory wipe:");
    if(promptVal !== 'RESET') return;
    
    await setDoc(doc(db,'artifacts',appId,'public','data','inventory','master'), {
        rawWeight: 0, unitsFull: 0, unitsUsual: 0, totalExpenses: 0, cashBalance: 0, liabilities: [], financedClients: []
    }, {merge:true});
    
    for(let u of globalRoster) {
        if(u.role !== 'admin') {
            await setDoc(doc(db,'artifacts',appId,'public','data','roster',u.id), {
                weight: 0, unitsFull: 0, unitsUsual: 0, soldWeight: 0, expected: 0, collected: 0, transactions: []
            }, {merge:true});
        }
    }
    alert("FACTORY RESET COMPLETE");
};

// Admin Stock Purchase
export const adminPurchaseStock = async (amount, cost, masterData) => {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventory', 'master'), {
        rawWeight: increment(amount),
        cashBalance: increment(-cost),
        totalExpenses: increment(cost)
    }, {merge:true});
};