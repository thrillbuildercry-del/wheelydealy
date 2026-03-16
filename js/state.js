// Global State Storage
window.appData = { 
    weight: 0, unitsFull: 0, unitsUsual: 0, soldWeight: 0, soldUnitsFull: 0, soldUnitsUsual: 0, 
    personalUseWeight: 0, personalUseOwed: 0, collected: 0, expected: 0, expenses: 0, borrowings: 0, 
    cashDropped: 0, transactions: [], notes: '' 
};
window.masterData = { 
    rawWeight: 0, unitsFull: 0, unitsUsual: 0, pricePerUnit: 100, usualRatio: 0.8, 
    adminDiscount: 20, staffDiscount: 20, staffCommission: 0, totalExpenses: 0, cashBalance: 0, 
    liabilities: [], financedClients: [], announcement: '' 
};
window.adminData = { 
    soldWeight: 0, soldUnitsFull: 0, soldUnitsUsual: 0, personalUseWeight: 0, personalUseOwed: 0, 
    collected: 0, expected: 0, expenses: 0, borrowings: 0, cashDropped: 0, transactions: [] 
};
window.globalRoster = []; 
window.currentDetailUid = null;
window.currentUser = null;
window.userRole = 'staff';
window.currentUserName = '';
window.lastInteraction = Date.now();

// Utilities
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

window.calculateAnalytics = (transactions) => {
    const now = Date.now();
    const periods = [
        { label: 'Today', ms: 86400000 }, 
        { label: '7 Days', ms: 604800000 }, 
        { label: '30 Days', ms: 2592000000 }
    ];
    let stats = periods.map(p => ({ label: p.label, pieces: 0, revenue: 0, expenses: 0, profit: 0 }));
    
    transactions.forEach(t => {
        const age = now - t.id;
        periods.forEach((p, index) => {
            if (age <= p.ms) {
                if (t.type === 'expense') stats[index].expenses += Math.abs(t.money);
                else if (t.type !== 'personal' && t.type !== 'borrowing' && t.type !== 'dropoff') { 
                    stats[index].revenue += (t.money || 0); 
                    stats[index].pieces += (t.qty || 0); 
                }
            }
        });
    });
    stats.forEach(s => s.profit = s.revenue - s.expenses);
    return stats;
};