import { doc, addDoc, collection, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, appId } from "./firebase-config.js";
import { state } from "./state.js";

// ============================================================================
// CONTACTS / ADDRESS BOOK LOGIC
// ============================================================================

window.openContactsModal = () => {
    document.getElementById('contacts-modal').classList.remove('hidden');
    window.filterContacts();
};

window.saveContact = async () => {
    const name = document.getElementById('new-contact-name').value;
    const phone = document.getElementById('new-contact-phone').value;
    const notes = document.getElementById('new-contact-notes').value;
    if(!name) return window.showToast("Contact Name is required.");
    
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'contacts'), {
        name, phone, notes, createdBy: state.currentUser.uid, createdAt: Date.now()
    });
    
    document.getElementById('new-contact-name').value = '';
    document.getElementById('new-contact-phone').value = '';
    document.getElementById('new-contact-notes').value = '';
    window.showToast("Contact Saved!");
};

window.deleteContact = async (id) => {
    if(confirm("Delete this contact permanently?")) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'contacts', id));
        window.showToast("Contact Deleted");
    }
};

window.filterContacts = () => {
    const searchInput = document.getElementById('contact-search');
    if (!searchInput) return;
    const term = searchInput.value.toLowerCase();
    const list = document.getElementById('contacts-list-container');
    if (!list) return;
    
    list.innerHTML = '';
    
    const filtered = state.globalContacts.filter(c => 
        (c.name && c.name.toLowerCase().includes(term)) || 
        (c.phone && c.phone.toLowerCase().includes(term)) ||
        (c.notes && c.notes.toLowerCase().includes(term))
    );
    
    if(filtered.length === 0) {
        list.innerHTML = '<div class="text-center py-6 text-xs text-gray-400 italic">No contacts found.</div>';
        return;
    }

    filtered.sort((a,b) => a.name.localeCompare(b.name)).forEach(c => {
        list.innerHTML += `
            <div class="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm mb-2">
                <div class="flex justify-between items-start mb-1">
                    <span class="font-bold dark:text-white text-sm flex items-center"><i data-lucide="user" class="w-3 h-3 mr-1 text-teal-500"></i> ${c.name}</span>
                    <button onclick="window.deleteContact('${c.id}')" class="text-red-400 hover:text-red-600 transition p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
                ${c.phone ? `<div class="text-xs text-gray-500 mb-1 flex items-center"><i data-lucide="phone" class="w-3 h-3 mr-1"></i> ${c.phone}</div>` : ''}
                ${c.notes ? `<div class="text-[10px] text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-2 rounded mt-1">${c.notes}</div>` : ''}
            </div>
        `;
    });
    if(typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
};

// ============================================================================
// TEAM CHAT LOGIC
// ============================================================================

window.openChatModal = () => {
    const modal = document.getElementById('chat-modal');
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('translate-y-full'); }, 10);
    
    state.chatUnreadCount = 0;
    const sBadge = document.getElementById('staff-chat-badge');
    const aBadge = document.getElementById('admin-chat-badge');
    if(sBadge) sBadge.classList.add('hidden');
    if(aBadge) aBadge.classList.add('hidden');
    
    window.renderChatMessages();
};

window.closeChatModal = () => {
    const modal = document.getElementById('chat-modal');
    modal.classList.add('translate-y-full');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
};

window.sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if(!text || !state.currentUser) return;
    
    input.value = '';
    
    // Keeping legacy naming (senderId, senderName) alongside new naming (uid, name) for backwards compatibility
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chat'), {
        uid: state.currentUser.uid,
        senderId: state.currentUser.uid,
        name: window.currentUserName || 'User',
        senderName: window.currentUserName || 'User',
        text: text,
        role: state.userRole,
        senderRole: state.userRole,
        timestamp: Date.now()
    });
};

window.renderChatMessages = () => {
    const container = document.getElementById('chat-messages');
    if(!container) return;
    container.innerHTML = '';
    
    let lastDate = '';
    
    state.chatMessages.forEach(msg => {
        const isMe = msg.uid === state.currentUser?.uid || msg.senderId === state.currentUser?.uid;
        const msgDate = new Date(msg.timestamp).toLocaleDateString();
        const msgTime = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        if (msgDate !== lastDate) {
            container.innerHTML += `<div class="text-center my-4"><span class="bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider">${msgDate}</span></div>`;
            lastDate = msgDate;
        }

        const align = isMe ? 'justify-end' : 'justify-start';
        const bg = isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white dark:bg-gray-800 dark:text-white rounded-bl-none shadow-sm border border-gray-100 dark:border-gray-700';
        
        const senderName = msg.name || msg.senderName || 'Unknown';
        const senderRole = msg.role || msg.senderRole;
        const roleBadge = senderRole && (senderRole.includes('admin') || senderRole.includes('manager')) ? '<i data-lucide="shield-check" class="w-3 h-3 text-yellow-400 inline ml-1"></i>' : '';
        
        const nameLabel = !isMe ? `<div class="text-[10px] text-gray-500 mb-1 font-bold ml-1">${senderName} ${roleBadge}</div>` : '';
        const timeColor = isMe ? 'text-blue-200' : 'text-gray-400';

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