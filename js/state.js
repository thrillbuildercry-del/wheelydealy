// GLOBAL STATE MANAGEMENT
// This centralizes all our variables so multiple files can read/write to them safely.

export const state = {
    currentUser: null, 
    userRole: 'staff', // Roles: 'staff', 'manager_soft', 'manager_hard', 'admin'
    currentDept: 'soft', // Tracks active product department tab ('soft' or 'hard')
    
    // Listeners so we can safely unsubscribe when logging out
    unsubs: {
        userData: null, roster: null, master: null, reqs: null, authCheck: null, alerts: null, contacts: null, chat: null
    },
    
    globalContacts: [],
    chatMessages: [],
    chatUnreadCount: 0,

    // Staff State (Updated for dual inventory system)
    appData: { 
        weight_soft: 0, unitsFull_soft: 0, unitsUsual_soft: 0, soldWeight_soft: 0, soldUnitsFull_soft: 0, soldUnitsUsual_soft: 0, 
        weight_hard: 0, unitsFull_hard: 0, unitsUsual_hard: 0, soldWeight_hard: 0, soldUnitsFull_hard: 0, soldUnitsUsual_hard: 0, 
        personalUseWeight: 0, personalUseOwed: 0, collected: 0, expected: 0, expenses: 0, borrowings: 0, 
        cashDropped: 0, transactions: [], notes: '' 
    },
    currentQty: 1, 
    currentType: 'full',

    // Admin State (Updated for dual inventory system)
    masterData: { 
        rawWeight_soft: 0, unitsFull_soft: 0, unitsUsual_soft: 0, pricePerUnit_soft: 100, usualRatio_soft: 0.8, 
        rawWeight_hard: 0, unitsFull_hard: 0, unitsUsual_hard: 0, pricePerUnit_hard: 100, usualRatio_hard: 0.8, 
        adminDiscount: 20, staffDiscount: 20, staffCommission: 0, totalExpenses: 0, cashBalance: 0, 
        liabilities: [], financedClients: [], announcement: '' 
    },
    adminData: { 
        soldWeight_soft: 0, soldUnitsFull_soft: 0, soldUnitsUsual_soft: 0, 
        soldWeight_hard: 0, soldUnitsFull_hard: 0, soldUnitsUsual_hard: 0, 
        personalUseWeight: 0, personalUseOwed: 0, collected: 0, expected: 0, expenses: 0, borrowings: 0, cashDropped: 0, transactions: [] 
    },
    
    globalRoster: [], 
    currentDetailUid: null,

    // Admin Terminal Sale State
    admCurrentQty: 1, 
    admCurrentType: 'full',

    // Chart Instances
    charts: {
        staff: null, adminOverall: null, adminDetail: null, adminTerminal: null, staffAnalytics: null, adminProfit: null
    }
};

// Expose state globally for debugging if needed
window.__APP_STATE__ = state;