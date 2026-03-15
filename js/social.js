import { addDoc, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, appId } from "./firebase-config.js";
import { state } from "./state.js";

// CHAT 
window.openChatModal = () => {
    const modal = document.getElementById('chat-modal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-y-full'), 10);
    
    state.chatUnreadCount = 0;
    const badge = document.getElementById('chat-badge');
    if(badge) badge.classList.add('hidden');
    window.renderChatMessages();
};

window.closeChatModal = () => {
    const modal = document.getElementById('chat-modal');
    modal.classList.add('translate-y-full');
    setTimeout(() => modal.classList.add('hidden'), 300);
};

window.sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if(!text || !state.user) return;
    
    input.value = '';
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chat'), {
        uid: state.user.uid,
        name: document.getElementById('top-user-name').innerText || 'User',
        text: text,
        role: state.role,
        timestamp: Date.now()
    });
};

window.renderChatMessages = () => {
    const container = document.getElementById('chat-messages');
    if(!container) return;
    container.innerHTML = '';
    
    let lastDate = '';
    
    state.chats.slice().reverse().forEach(msg => {
        const isMe = msg.uid === state.user?.uid;
        const msgDate = new Date(msg.timestamp).toLocaleDateString();
        const msgTime = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        if (msgDate !== lastDate) {
            container.innerHTML += `<div class="text-center my-4"><span class="bg-elevated border border-bordercol text-gray-500 text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider">${msgDate}</span></div>`;
            lastDate = msgDate;
        }

        const align = isMe ? 'justify-end' : 'justify-start';
        const bg = isMe ? 'bg-gradient-to-br from-neonblue to-blue-600 text-white rounded-br-none' : 'bg-elevated text-gray-200 border border-bordercol rounded-bl-none shadow-sm';
        
        const senderName = msg.name || 'Unknown';
        const roleBadge = msg.role && msg.role.includes('admin') ? '<i data-lucide="shield-check" class="w-3 h-3 text-yellow-400 inline ml-1"></i>' : '';
        
        const nameLabel = !isMe ? `<div class="text-[10px] text-gray-500 mb-1 font-bold ml-1">${senderName} ${roleBadge}</div>` : '';
        const timeColor = isMe ? 'text-blue-200' : 'text-gray-500';

        container.innerHTML += `
            <div class="flex ${align} mb-3">
                <div class="max-w-[80%]">
                    ${nameLabel}
                    <div class="p-3 rounded-2xl ${bg} text-sm break-words">
                        ${msg.text}
                    </div>
                    <div class="text-[9px] ${timeColor} mt-1 ${isMe ? 'text-right mr-1' : 'ml-1'}">${msgTime}</div>
                </div>
            </div>
        `;
    });
    
    setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
    if(typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
};

// CONTACTS / ADDRESS BOOK
window.openContactsModal = () => {
    document.getElementById('contacts-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('contacts-modal').classList.remove('translate-y-full'), 10);
    window.filterContacts();
};

window.closeContactsModal = () => {
    document.getElementById('contacts-modal').classList.add('translate-y-full');
    setTimeout(() => document.getElementById('contacts-modal').classList.add('hidden'), 300);
};

window.filterContacts = () => {
    const searchInput = document.getElementById('contact-search');
    if (!searchInput) return;
    const term = searchInput.value.toLowerCase();
    const list = document.getElementById('contacts-list-container');
    if (!list) return;
    
    list.innerHTML = '';
    
    const filtered = (state.contacts || []).filter(c => 
        (c.name && c.name.toLowerCase().includes(term)) || 
        (c.phone && c.phone.toLowerCase().includes(term))
    );
    
    if(filtered.length === 0) {
        list.innerHTML = '<div class="text-center py-6 text-xs text-gray-500">No contacts found.</div>';
        return;
    }

    filtered.sort((a,b) => a.name.localeCompare(b.name)).forEach(c => {
        list.innerHTML += `
            <div class="bg-card p-3 rounded-xl border border-bordercol shadow-sm mb-2">
                <div class="flex justify-between items-start mb-1">
                    <span class="font-bold text-white text-sm flex items-center"><i data-lucide="user" class="w-3 h-3 mr-2 text-neonpurple"></i> ${c.name}</span>
                </div>
                ${c.phone ? `<div class="text-xs text-gray-400 flex items-center"><i data-lucide="phone" class="w-3 h-3 mr-2"></i> ${c.phone}</div>` : ''}
            </div>
        `;
    });
    if(typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
};