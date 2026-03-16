import { db, appId } from './firebase-config.js';
import { collection, addDoc, onSnapshot, query, orderBy, limit, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// FEATURE: Manager Exchange
window.openManagerExchange = (targetUid = null) => {
    // If targetUid is null, it's Staff opening their own board
    const fetchUid = targetUid || window.currentUser.uid;
    document.getElementById('exchange-target-uid').value = fetchUid;
    document.getElementById('manager-exchange-modal').classList.remove('hidden');
    
    // Subscribe to specific notes
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'manager_notes'), where('staffId', '==', fetchUid), orderBy('timestamp', 'desc'), limit(20));
    
    window.unsubExchange = onSnapshot(q, (snap) => {
        const container = document.getElementById('exchange-messages');
        container.innerHTML = '';
        const notes = [];
        snap.forEach(d => notes.unshift(d.data())); // reverse chronological
        
        if(notes.length === 0) container.innerHTML = '<div class="text-center text-gray-500 mt-10 italic text-sm">No notes yet. Start the exchange!</div>';

        notes.forEach(msg => {
            const isMe = msg.senderId === window.currentUser.uid;
            const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const bgClass = msg.senderRole === 'admin' ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-200' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-100';
            
            container.innerHTML += `
                <div class="mb-3 ${isMe ? 'text-right' : 'text-left'}">
                    <div class="text-[10px] text-gray-500 mb-1 font-bold tracking-wide">${msg.senderName} • ${time}</div>
                    <div class="inline-block p-3 rounded-xl border ${bgClass} shadow-sm text-sm dark:text-white max-w-[85%] text-left">
                        ${msg.text}
                    </div>
                </div>`;
        });
        container.scrollTop = container.scrollHeight;
    });
};

window.sendExchangeMessage = async () => {
    const input = document.getElementById('exchange-input');
    const text = input.value.trim();
    if(!text) return;
    
    const staffId = document.getElementById('exchange-target-uid').value;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'manager_notes'), {
        text, staffId, senderId: window.currentUser.uid, senderName: window.currentUserName, senderRole: window.userRole, timestamp: Date.now()
    });
    input.value = '';
};

window.closeManagerExchange = () => {
    document.getElementById('manager-exchange-modal').classList.add('hidden');
    if(window.unsubExchange) window.unsubExchange();
};

// Standard Chat
window.openChatModal = () => {
    const modal = document.getElementById('chat-modal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-y-full'), 10);
    
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'chat'), orderBy('timestamp', 'desc'), limit(50));
    onSnapshot(q, (snap) => {
        const container = document.getElementById('chat-messages');
        container.innerHTML = '';
        const chatMsgs = [];
        snap.forEach(d => chatMsgs.unshift(d.data()));
        
        chatMsgs.forEach(msg => {
            const isMe = msg.senderId === window.currentUser.uid;
            const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            container.innerHTML += `
                <div class="flex ${isMe ? 'justify-end' : 'justify-start'} mb-3">
                    <div class="max-w-[75%]">
                        <div class="text-[9px] text-gray-500 mb-0.5 ml-1 ${isMe ? 'text-right mr-1' : ''}">${isMe ? 'You' : msg.senderName} • ${time}</div>
                        <div class="p-3 rounded-2xl text-sm shadow-sm ${isMe ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white dark:bg-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-tl-sm'}">${msg.text}</div>
                    </div>
                </div>`;
        });
        container.scrollTop = container.scrollHeight;
    });
};

window.sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if(!text) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chat'), {
        text, senderId: window.currentUser.uid, senderName: window.currentUserName, senderRole: window.userRole, timestamp: Date.now()
    });
    input.value = '';
};

window.closeChatModal = () => {
    const modal = document.getElementById('chat-modal');
    modal.classList.add('translate-y-full');
    setTimeout(() => modal.classList.add('hidden'), 300);
};