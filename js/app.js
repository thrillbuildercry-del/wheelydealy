import { doc, onSnapshot, collection, setDoc, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, appId, messaging } from "./firebase-config.js";
import { getToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js";
import { state, getMF, getAF } from "./state.js";
import "./auth.js"; 

// UTILITIES & GLOBAL BINDINGS
window.showToast = (msg) => { const t=document.getElementById('toast'); t.innerText=msg; t.className="show"; setTimeout(()=>t.className="",3000); };
window.toggleTheme = () => { document.documentElement.classList.toggle('dark'); localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light'); };

window.switchTab = (tab) => {
    ['dashboard','terminal','tools','profile','admin-staff'].forEach(x => {
        const el = document.getElementById(`view-${x}`);
        const btn = document.getElementById(`nav-${x}`);
        if(el) { el.classList.remove('active'); el.classList.add('hidden'); }
        if(btn) { btn.classList.remove('text-neonblue', 'text-neonpurple'); btn.classList.add('text-gray-500'); }
    });
    document.getElementById(`view-${tab}`).classList.remove('hidden');
    document.getElementById(`view-${tab}`).classList.add('active');
    const color = state.role.includes('admin') && tab.includes('admin') ? 'text-neonpurple' : 'text-neonblue';
    document.getElementById(`nav-${tab}`).classList.remove('text-gray-500');
    document.getElementById(`nav-${tab}`).classList.add(color);
};

window.switchDept = (dept) => {
    if(state.role==='manager_soft' && dept==='hard') return window.showToast("Restricted: Soft Dept Only");
    if(state.role==='manager_hard' && dept==='soft') return window.showToast("Restricted: Hard Dept Only");
    state.dept = dept;
    ['soft','hard'].forEach(d => {
        document.getElementById(`dept-${d}`).className = d===dept ? `flex-1 py-2 text-xs font-bold rounded-lg bg-elevated text-white shadow-md transition btn-interactive border ${d==='soft'?'border-neonblue/50':'border-neonpurple/50'}` : "flex-1 py-2 text-xs font-bold rounded-lg text-gray-500 hover:text-white transition btn-interactive border border-transparent";
    });
    renderUI();
};

// INITIALIZATION
export const initData = (uid) => {
    state.unsubs.master = onSnapshot(doc(db,'artifacts',appId,'public','data','inventory','master'), snap => {
        if(snap.exists()) state.mst = { ...state.mst, ...snap.data() };
        renderUI();
    });
    state.unsubs.user = onSnapshot(doc(db,'artifacts',appId,'users',uid,'data','app_state'), snap => {
        if(snap.exists()) {
            const d = JSON.parse(snap.data().json);
            if(state.role === 'staff') state.stf = {...state.stf, ...d};
            else state.adm = {...state.adm, ...d};
            renderUI();
        }
    });
    if(state.role.includes('admin') || state.role.includes('manager')) {
        state.unsubs.roster = onSnapshot(collection(db,'artifacts',appId,'public','data','roster'), snap => {
            state.roster = []; snap.forEach(d=>state.roster.push({id:d.id,...d.data()}));
            renderAdminTeam();
        });
    }
    if ("Notification" in window && Notification.permission !== "granted") {
        const banner = document.getElementById('push-setup-banner');
        if (banner) banner.classList.remove('hidden');
    }
};

// CORE UI RENDERER
const renderUI = () => {
    const price = state.mst[getMF('pricePerUnit')] || 100;
    const ratio = state.mst[getMF('usualRatio')] || 0.8;
    
    const lblFull = document.getElementById('lbl-full');
    const lblUsual = document.getElementById('lbl-usual');
    if(lblFull) lblFull.innerText = `(1.0u @ $${price})`;
    if(lblUsual) lblUsual.innerText = `(${ratio}u @ $${price*ratio})`;
    
    const curPrice = state.type === 'full' ? price : price*ratio;
    const lblExp = document.getElementById('lbl-expected');
    if(lblExp) lblExp.innerText = `Expected: $${state.qty * curPrice}`;
    
    const btnQpUsual = document.getElementById('btn-qp-usual');
    const btnQpFull = document.getElementById('btn-qp-full');
    if(btnQpUsual) btnQpUsual.innerText = `$${price*ratio}`;
    if(btnQpFull) btnQpFull.innerText = `$${price}`;

    if(state.role === 'staff') {
        const wField = getMF('weight'); const fField = getMF('unitsFull'); const uField = getMF('unitsUsual');
        document.getElementById('dash-raw').innerText = (state.stf[wField]||0).toFixed(1);
        document.getElementById('dash-full').innerText = state.stf[fField]||0;
        document.getElementById('dash-usual').innerText = state.stf[uField]||0;
        document.getElementById('dash-cash').innerText = `$${state.stf.collected||0}`;
        
        const comm = (state.stf.collected||0) * (state.mst.staffCommission/100);
        const debt = (state.stf.personalUseOwed||0) + (state.stf.borrowings||0);
        const applied = Math.min(comm, debt);
        const netComm = comm - applied;
        const drawer = (state.stf.collected||0) - (state.stf.expenses||0) - (state.stf.cashDropped||0) - netComm;
        
        document.getElementById('dash-comm').innerText = `$${comm.toFixed(2)}`;
        document.getElementById('dash-debt').innerText = `-$${debt.toFixed(2)}`;
        document.getElementById('dash-net-status').innerText = `$${drawer.toFixed(2)}`;
        document.getElementById('dash-net-status').className = `text-sm font-black ${drawer<0?'text-red-500':'text-neonblue'}`;
        
        renderChart(state.stf.txs);
    } else {
        document.getElementById('dash-raw').innerText = (state.mst[getMF('rawWeight')]||0).toFixed(1);
        document.getElementById('dash-full').innerText = state.mst[getMF('unitsFull')]||0;
        document.getElementById('dash-usual').innerText = state.mst[getMF('unitsUsual')]||0;
        document.getElementById('dash-cash').innerText = `$${state.mst.cashBalance||0}`;
        
        document.getElementById('dash-comm').innerText = "N/A (Admin)";
        document.getElementById('dash-debt').innerText = "N/A";
        document.getElementById('dash-net-status').innerText = `$${state.mst.cashBalance||0}`;
        document.getElementById('dash-net-status').className = 'text-sm font-black text-neonpurple';
        
        renderChart(state.adm.txs);
    }
};

const renderChart = (txs) => {
    const canvas = document.getElementById('mainLineChart');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const sales = txs.filter(t=>t.type==='full'||t.type==='usual'||t.type==='raw').filter(t=>t.dept===state.dept).reverse().slice(-15);
    document.getElementById('dash-total-pieces').innerText = `${sales.reduce((acc,t)=>acc+t.qty,0)} units`;
    
    if(state.charts.lineChart) state.charts.lineChart.destroy();
    let gradient = ctx.createLinearGradient(0, 0, 0, 150);
    const color = state.dept==='soft'?'0, 210, 255':'138, 43, 226';
    gradient.addColorStop(0, `rgba(${color}, 0.5)`);
    gradient.addColorStop(1, `rgba(${color}, 0)`);

    state.charts.lineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sales.map(t=>t.time),
            datasets: [{
                data: sales.map(t=>t.money),
                borderColor: state.dept==='soft'?'#00d2ff':'#8a2be2',
                backgroundColor: gradient,
                borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
            scales: { x: { display: false }, y: { display: false, beginAtZero: true } }
        }
    });
};

const renderAdminTeam = () => {
    const list = document.getElementById('admin-staff-list');
    if(!list) return; list.innerHTML = '';
    state.roster.filter(u=>u.status==='active'&&u.role==='staff').forEach(u => {
        const diff = (u.expected||0) - (u.collected||0);
        list.innerHTML += `
            <div class="bg-elevated p-3 rounded-xl border border-bordercol flex justify-between items-center mb-2">
                <div class="flex items-center"><div class="w-8 h-8 rounded bg-card text-white flex items-center justify-center font-bold mr-3 border border-bordercol">${u.name[0]}</div>
                <div><p class="text-sm font-bold text-white">${u.name}</p><p class="text-[10px] text-gray-500">Hold: ${(u[`weight_${state.dept}`]||0).toFixed(1)}u | Sold: ${(u[`soldWeight_${state.dept}`]||0).toFixed(1)}u</p></div></div>
                <div class="text-right"><p class="text-xs font-bold text-green-400">$${(u.collected||0).toFixed(0)}</p><p class="text-[10px] ${diff>0?'text-red-500':'text-gray-500'}">${diff>0?`-$${diff.toFixed(0)}`:'Balanced'}</p></div>
            </div>`;
    });
    document.getElementById('adm-active-count').innerText = state.roster.filter(u=>u.status==='active').length + " Active";
};

// TERMINAL CONTROLS
window.setQty = (q) => { state.qty=q; document.querySelectorAll('.qty-btn').forEach(b=>{b.classList.remove('bg-neonblue/20','border-neonblue','text-neonblue'); b.classList.add('bg-elevated','text-gray-400');}); const btn=document.getElementById(`qty-${q}`); btn.classList.remove('bg-elevated','text-gray-400'); btn.classList.add('bg-neonblue/20','border','border-neonblue','text-neonblue'); renderUI(); };
window.setType = (t) => { state.type=t; document.querySelectorAll('.type-btn').forEach(b=>{b.classList.remove('bg-neonblue/20','border-neonblue','text-white'); b.classList.add('bg-elevated','text-gray-400');}); const btn=document.getElementById(`type-${t}`); btn.classList.remove('bg-elevated','text-gray-400'); btn.classList.add('bg-neonblue/20','border','border-neonblue','text-white'); renderUI(); };
window.setSource = (src) => { state.src=src; document.getElementById('src-processed').className=src==='processed'?'flex-1 py-2 text-xs font-bold bg-card text-white rounded-lg shadow-sm transition btn-interactive':'flex-1 py-2 text-xs font-bold text-gray-500 hover:text-white transition btn-interactive'; document.getElementById('src-raw').className=src==='raw'?'flex-1 py-2 text-xs font-bold bg-card text-white rounded-lg shadow-sm transition btn-interactive':'flex-1 py-2 text-xs font-bold text-gray-500 hover:text-white transition btn-interactive'; };
window.quickPrc = (t) => { const price=state.mst[getMF('pricePerUnit')]||100; const r=state.mst[getMF('usualRatio')]||0.8; document.getElementById('money-input').value = t==='full'?state.qty*price:state.qty*price*r; window.checkMoney(); };

window.checkMoney = () => { 
    const el = document.getElementById('money-input'); const val = parseFloat(el.value)||0;
    const price = state.mst[getMF('pricePerUnit')]||100; const r = state.mst[getMF('usualRatio')]||0.8;
    const exp = state.type==='full'?state.qty*price:state.qty*price*r;
    el.classList.remove('text-white','text-red-400','text-green-400');
    if(val===0) el.classList.add('text-white'); else if(val<exp) el.classList.add('text-red-400'); else el.classList.add('text-green-400');
};

// PROCESSING SALE LOGIC
window.logSale = async () => {
    const m = parseFloat(document.getElementById('money-input').value);
    if(isNaN(m)) return window.showToast("Enter money");
    
    const price = state.mst[getMF('pricePerUnit')]||100; const r = state.mst[getMF('usualRatio')]||0.8;
    const w = state.type==='full'?state.qty*1.0:state.qty*r; const exp = state.type==='full'?state.qty*price:state.qty*price*r;
    
    let obj = state.role==='staff' ? state.stf : state.adm;
    
    if(state.role==='staff') {
        if(state.src==='raw') { if((obj[getMF('weight')]||0)<w) return window.showToast("Not enough raw!"); obj[getMF('weight')]-=w; obj[getMF('soldWeight')]=(obj[getMF('soldWeight')]||0)+w; }
        else if(state.type==='full') { if((obj[getMF('unitsFull')]||0)<state.qty) return window.showToast("Not enough full units!"); obj[getMF('unitsFull')]-=state.qty; obj[getMF('soldUnitsFull')]=(obj[getMF('soldUnitsFull')]||0)+state.qty;}
        else { if((obj[getMF('unitsUsual')]||0)<state.qty) return window.showToast("Not enough usual units!"); obj[getMF('unitsUsual')]-=state.qty; obj[getMF('soldUnitsUsual')]=(obj[getMF('soldUnitsUsual')]||0)+state.qty;}
    } else {
        let mUpd = { cashBalance: increment(m) };
        if(state.src==='raw') { if((state.mst[getMF('rawWeight')]||0)<w) return window.showToast("Not enough master raw!"); mUpd[getMF('rawWeight')]=increment(-w); obj[getMF('soldWeight')]=(obj[getMF('soldWeight')]||0)+w;}
        else if(state.type==='full') { if((state.mst[getMF('unitsFull')]||0)<state.qty) return window.showToast("Not enough master full!"); mUpd[getMF('unitsFull')]=increment(-state.qty); obj[getMF('soldUnitsFull')]=(obj[getMF('soldUnitsFull')]||0)+state.qty;}
        else { if((state.mst[getMF('unitsUsual')]||0)<state.qty) return window.showToast("Not enough master usual!"); mUpd[getMF('unitsUsual')]=increment(-state.qty); obj[getMF('soldUnitsUsual')]=(obj[getMF('soldUnitsUsual')]||0)+state.qty;}
        await setDoc(doc(db,'artifacts',appId,'public','data','inventory','master'), mUpd, {merge:true});
    }

    obj.collected += m; obj.expected += exp;
    obj.txs.push({id:Date.now(), time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}), type:state.type, qty:state.qty, src:state.src, dept:state.dept, weight:w, money:m, expected:exp});
    
    await setDoc(doc(db,'artifacts',appId,'users',state.user.uid,'data','app_state'), {json:JSON.stringify(obj), lastUpd:Date.now()});
    if(state.role==='staff') await setDoc(doc(db,'artifacts',appId,'public','data','roster',state.user.uid), {collected:obj.collected, expected:obj.expected}, {merge:true});
    
    document.getElementById('money-input').value=''; window.checkMoney(); window.showToast("Sale Logged!");
};

// PUSH NOTIFICATION HELPERS
window.enableNotifications = async () => {
    if(!messaging) return;
    const p = await Notification.requestPermission();
    if(p==='granted') {
        const reg = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
        // NOTE: Uses VAPID key injected directly from the Firebase Config settings earlier
        const t = await getToken(messaging, {vapidKey:'BGXHvTieu13FAj7cONvGtt5vB-PIBjyzJoZmSrSXT23Rk8t4DZaPJR7AYGBJVfSrisEEJN44B7DFyTPSTEr1tKs', serviceWorkerRegistration:reg});
        if(t) await setDoc(doc(db,'artifacts',appId,'users',state.user.uid,'settings','pushToken'), {token:t}, {merge:true});
        document.getElementById('push-setup-banner').classList.add('hidden');
        const toggle = document.getElementById('notif-toggle');
        if (toggle) toggle.checked = true;
    }
};
window.toggleNotifications = (el) => { if(el.checked) window.enableNotifications(); else window.showToast("Disable in iOS Settings."); };