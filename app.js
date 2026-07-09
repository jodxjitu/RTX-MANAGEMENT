const ADMIN_PIN = '2011';
const state = { tenants:{}, rooms:{}, rents:{}, electricity:{}, charges:{} };
const $ = id => document.getElementById(id);
const money = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0,10);
const thisMonth = () => new Date().toISOString().slice(0,7);
const firstDayOfMonth = (m=thisMonth()) => `${m}-01`;
const lastDayOfMonth = (m=thisMonth()) => { const [y,mo]=m.split('-').map(Number); return new Date(y, mo, 0).toISOString().slice(0,10); };
const periodText = (from,to) => from && to ? `${from} to ${to}` : from || to || '-';
const uid = () => db.ref().push().key;
const safe = v => String(v ?? '').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const arr = obj => Object.entries(obj || {}).map(([id,v]) => ({id,...v}));

const refs = {
  tenants: db.ref('tenants'), rooms: db.ref('rooms'), rents: db.ref('rents'),
  electricity: db.ref('electricity'), charges: db.ref('charges')
};

window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || String(event.reason || 'Unknown Firebase error');
  const box = document.getElementById('dbStatus');
  if (box) box.textContent = 'Database Error: ' + msg;
  console.error('Firebase Database Error:', event.reason);
  if (msg.toLowerCase().includes('permission')) {
    toast('Firebase rules permission denied. README me rules set karo.');
  } else {
    toast('Database error: ' + msg);
  }
});

async function dbSet(ref, data, successMsg){
  try {
    await ref.set(data);
    toast(successMsg || 'Saved successfully');
    return true;
  } catch (err) {
    const msg = err?.message || String(err);
    $('dbStatus').textContent = 'Database Error: ' + msg;
    console.error(err);
    toast(msg.toLowerCase().includes('permission') ? 'Permission denied: Firebase rules check karo' : 'Save failed: ' + msg);
    return false;
  }
}
async function dbUpdate(ref, data, successMsg){
  try {
    await ref.update(data);
    if(successMsg) toast(successMsg);
    return true;
  } catch (err) {
    const msg = err?.message || String(err);
    $('dbStatus').textContent = 'Database Error: ' + msg;
    console.error(err);
    toast(msg.toLowerCase().includes('permission') ? 'Permission denied: Firebase rules check karo' : 'Update failed: ' + msg);
    return false;
  }
}
async function dbRemove(ref){
  try {
    await ref.remove();
    toast('Deleted');
    return true;
  } catch (err) {
    const msg = err?.message || String(err);
    $('dbStatus').textContent = 'Database Error: ' + msg;
    console.error(err);
    toast('Delete failed: ' + msg);
    return false;
  }
}

function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2200); }
function tenant(id){ return state.tenants[id] || {}; }
function tenantName(id){ const t=tenant(id); return t.name ? `${t.name}` : 'Unknown'; }
function tenantRoom(id){ return tenant(id).room || '-'; }
function activeTenants(){ return arr(state.tenants).filter(t => t.status !== 'Left'); }
function sum(list, key){ return list.reduce((s,x)=>s+(+x[key]||0),0); }
function calcStatus(total, paid){ paid=+paid||0; total=+total||0; return paid >= total && total > 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Pending'; }

function initLogin(){
  if(localStorage.getItem('rtxLoggedIn') === 'yes') showApp();
  $('loginForm').onsubmit = e => { e.preventDefault(); if($('pinInput').value === ADMIN_PIN){ localStorage.setItem('rtxLoggedIn','yes'); showApp(); } else toast('Wrong PIN'); };
  $('logoutBtn').onclick = () => { localStorage.removeItem('rtxLoggedIn'); location.reload(); };
  $('clearLocalBtn').onclick = () => { localStorage.removeItem('rtxLoggedIn'); location.reload(); };
}
function showApp(){ $('loginScreen').classList.add('hidden'); $('appRoot').classList.remove('hidden'); }
initLogin();

Object.entries(refs).forEach(([key, ref]) => {
  ref.on('value', snap => { state[key] = snap.val() || {}; $('dbStatus').textContent = 'Database Connected'; renderAll(); }, err => { $('dbStatus').textContent = 'Database Error'; toast(err.message); });
});

function setDefaults(){
  ['tenantJoin','rentDate','chargeDate'].forEach(id => { if($(id) && !$(id).value) $(id).value = today(); });
  ['rentMonth','elecMonth','reportMonth'].forEach(id => { if($(id) && !$(id).value) $(id).value = thisMonth(); });
  if($('rentFrom') && !$('rentFrom').value) $('rentFrom').value = firstDayOfMonth($('rentMonth')?.value || thisMonth());
  if($('rentTo') && !$('rentTo').value) $('rentTo').value = lastDayOfMonth($('rentMonth')?.value || thisMonth());
  if($('elecFrom') && !$('elecFrom').value) $('elecFrom').value = firstDayOfMonth($('elecMonth')?.value || thisMonth());
  if($('elecTo') && !$('elecTo').value) $('elecTo').value = lastDayOfMonth($('elecMonth')?.value || thisMonth());
}
setDefaults();

function closeMobileSidebar(){
  const sidebar = $('sidebar');
  const overlay = $('sidebarOverlay');
  if(sidebar) sidebar.classList.remove('open');
  if(overlay) overlay.classList.remove('show');
}
function toggleMobileSidebar(){
  const sidebar = $('sidebar');
  const overlay = $('sidebarOverlay');
  if(!sidebar || !overlay) return;
  const isOpen = sidebar.classList.toggle('open');
  overlay.classList.toggle('show', isOpen);
}

function switchPage(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.page===page));
  $(page).classList.add('active');
  $('pageTitle').textContent = document.querySelector(`[data-page="${page}"]`)?.textContent.replace(/^[^A-Za-z]+/,'').trim() || 'Dashboard';
  closeMobileSidebar();
}

document.querySelectorAll('[data-page]').forEach(b => b.onclick = () => switchPage(b.dataset.page));
document.querySelectorAll('[data-page-jump]').forEach(b => b.onclick = () => switchPage(b.dataset.pageJump));
$('menuBtn').onclick = toggleMobileSidebar;
if($('sidebarOverlay')) $('sidebarOverlay').onclick = closeMobileSidebar;
$('printBtn').onclick = () => printActivePage();
$('printReportBtn').onclick = () => printReportOnly();

function fillSelects(){
  const opts = activeTenants().sort((a,b)=>String(a.room).localeCompare(String(b.room))).map(t => `<option value="${t.id}">${safe(t.name)} - Room ${safe(t.room)}</option>`).join('');
  ['rentTenant','elecTenant','chargeTenant'].forEach(id => { if($(id)) $(id).innerHTML = opts || '<option value="">No tenant added</option>'; });
  $('reportTenant').innerHTML = '<option value="all">All Tenants</option>' + opts;
  $('quickRentForm').innerHTML = `<label>Tenant<select id="quickTenant">${opts || '<option value="">No tenant added</option>'}</select></label><label>Month<input id="quickMonth" type="month" value="${thisMonth()}"></label><label>From Date<input id="quickFrom" type="date" value="${firstDayOfMonth()}"></label><label>To Date<input id="quickTo" type="date" value="${lastDayOfMonth()}"></label><label>Paid Amount<input id="quickPaid" type="number" min="0" placeholder="Monthly rent"></label><button class="primary-btn" type="submit">Save Quick Rent</button>`;
  $('quickRentForm').onsubmit = quickRent;
}

$('tenantForm').onsubmit = async e => { e.preventDefault(); const id = $('tenantId').value || uid(); const data = { name:$('tenantName').value.trim(), mobile:$('tenantMobile').value.trim(), room:$('tenantRoom').value.trim(), joinDate:$('tenantJoin').value, rent:+$('tenantRent').value||0, deposit:+$('tenantDeposit').value||0, idProof:$('tenantIdProof').value.trim(), status:$('tenantStatus').value, notes:$('tenantNotes').value.trim(), updatedAt:new Date().toISOString() }; if(!state.tenants[id]) data.createdAt = new Date().toISOString(); if(await dbSet(refs.tenants.child(id), data, 'Tenant saved')){ await syncRoomFromTenant(data); clearTenant(); } };
async function syncRoomFromTenant(t){ const existing = arr(state.rooms).find(r => String(r.no).toLowerCase() === String(t.room).toLowerCase()); if(existing) await dbUpdate(refs.rooms.child(existing.id), {status:t.status==='Active'?'Occupied':'Vacant', rent:t.rent || existing.rent || 0}); }
function clearTenant(){ $('tenantForm').reset(); $('tenantId').value=''; $('tenantJoin').value=today(); $('tenantStatus').value='Active'; }
$('clearTenantBtn').onclick = clearTenant;
window.editTenant = id => { const t=state.tenants[id]; if(!t) return; $('tenantId').value=id; $('tenantName').value=t.name||''; $('tenantMobile').value=t.mobile||''; $('tenantRoom').value=t.room||''; $('tenantJoin').value=t.joinDate||today(); $('tenantRent').value=t.rent||0; $('tenantDeposit').value=t.deposit||0; $('tenantIdProof').value=t.idProof||''; $('tenantStatus').value=t.status||'Active'; $('tenantNotes').value=t.notes||''; switchPage('tenants'); window.scrollTo({top:0,behavior:'smooth'}); };

$('roomForm').onsubmit = async e => { e.preventDefault(); const id=$('roomId').value || uid(); const data={no:$('roomNo').value.trim(), floor:$('roomFloor').value.trim(), rent:+$('roomRent').value||0, status:$('roomStatus').value, note:$('roomNote').value.trim(), updatedAt:new Date().toISOString()}; if(!state.rooms[id]) data.createdAt=new Date().toISOString(); if(await dbSet(refs.rooms.child(id), data, 'Room saved')) clearRoom(); };
function clearRoom(){ $('roomForm').reset(); $('roomId').value=''; $('roomStatus').value='Vacant'; }
$('clearRoomBtn').onclick = clearRoom;
window.editRoom = id => { const r=state.rooms[id]; if(!r) return; $('roomId').value=id; $('roomNo').value=r.no||''; $('roomFloor').value=r.floor||''; $('roomRent').value=r.rent||0; $('roomStatus').value=r.status||'Vacant'; $('roomNote').value=r.note||''; switchPage('rooms'); window.scrollTo({top:0,behavior:'smooth'}); };

$('rentTenant').onchange = () => { const t=tenant($('rentTenant').value); $('rentAmount').value=t.rent||0; };
$('rentMonth').onchange = () => { $('rentFrom').value = firstDayOfMonth($('rentMonth').value); $('rentTo').value = lastDayOfMonth($('rentMonth').value); };
$('elecMonth').onchange = () => { $('elecFrom').value = firstDayOfMonth($('elecMonth').value); $('elecTo').value = lastDayOfMonth($('elecMonth').value); };
$('rentForm').onsubmit = async e => { e.preventDefault(); const editId=$('rentId')?.value || ''; const total=+$('rentAmount').value||0, paid=+$('rentPaid').value||0; const data={tenantId:$('rentTenant').value, month:$('rentMonth').value, periodFrom:$('rentFrom').value, periodTo:$('rentTo').value, rentAmount:total, paidAmount:paid, pending:Math.max(0,total-paid), date:$('rentDate').value||today(), mode:$('rentMode').value, status:$('rentStatus').value || calcStatus(total,paid), note:$('rentNote').value.trim(), updatedAt:new Date().toISOString()}; if(!data.tenantId) return toast('Select tenant first'); if(!editId) data.createdAt=new Date().toISOString(); if(await dbSet(refs.rents.child(editId || uid()), data, editId ? 'Rent updated' : 'Rent saved')){ clearRentEdit(); } };
async function quickRent(e){ e.preventDefault(); const tid=$('quickTenant').value; if(!tid) return toast('Add tenant first'); const total=+tenant(tid).rent||0, paid=+$('quickPaid').value||0; if(await dbSet(refs.rents.child(uid()), {tenantId:tid, month:$('quickMonth').value, periodFrom:$('quickFrom').value, periodTo:$('quickTo').value, rentAmount:total, paidAmount:paid, pending:Math.max(0,total-paid), date:today(), mode:'Cash', status:calcStatus(total,paid), note:'Quick entry', createdAt:new Date().toISOString()}, 'Quick rent saved')) $('quickPaid').value=''; }

function updateElecTotal(){ const prev=+$('prevReading').value||0, curr=+$('currReading').value||0, rate=+$('rateUnit').value||0; $('elecTotal').value = Math.max(0,curr-prev)*rate; }
['prevReading','currReading','rateUnit'].forEach(id => $(id).addEventListener('input', updateElecTotal));
$('electricityForm').onsubmit = async e => { e.preventDefault(); const editId=$('elecId')?.value || ''; const prev=+$('prevReading').value||0, curr=+$('currReading').value||0, units=Math.max(0,curr-prev), rate=+$('rateUnit').value||0, total=units*rate, paid=+$('elecPaid').value||0; const data={tenantId:$('elecTenant').value, month:$('elecMonth').value, periodFrom:$('elecFrom').value, periodTo:$('elecTo').value, prevReading:prev, currReading:curr, units, rate, total, paid, pending:Math.max(0,total-paid), status:$('elecStatus').value, note:$('elecNote').value.trim(), updatedAt:new Date().toISOString()}; if(!data.tenantId) return toast('Select tenant first'); if(!editId) data.createdAt=new Date().toISOString(); if(await dbSet(refs.electricity.child(editId || uid()), data, editId ? 'Electricity bill updated' : 'Electricity bill saved')){ clearElecEdit(); } };

$('chargeForm').onsubmit = async e => { e.preventDefault(); const editId=$('chargeId')?.value || ''; const amount=+$('chargeAmount').value||0, paid=+$('chargePaid').value||0; const data={tenantId:$('chargeTenant').value, type:$('chargeType').value, amount, paid, pending:Math.max(0,amount-paid), date:$('chargeDate').value||today(), status:$('chargeStatus').value, note:$('chargeNote').value.trim(), updatedAt:new Date().toISOString()}; if(!data.tenantId) return toast('Select tenant first'); if(!editId) data.createdAt=new Date().toISOString(); if(await dbSet(refs.charges.child(editId || uid()), data, editId ? 'Charge updated' : 'Charge saved')){ clearChargeEdit(); } };


window.clearRentEdit = () => { $('rentForm').reset(); if($('rentId')) $('rentId').value=''; if($('rentSubmitBtn')) $('rentSubmitBtn').textContent='Save Rent'; $('rentCancelEditBtn')?.classList.add('hidden'); setDefaults(); };
window.editRent = id => { const r=state.rents[id]; if(!r) return toast('Record not found'); $('rentId').value=id; $('rentTenant').value=r.tenantId||''; $('rentMonth').value=r.month||thisMonth(); $('rentFrom').value=r.periodFrom||firstDayOfMonth(r.month||thisMonth()); $('rentTo').value=r.periodTo||lastDayOfMonth(r.month||thisMonth()); $('rentAmount').value=r.rentAmount||0; $('rentPaid').value=r.paidAmount||0; $('rentDate').value=r.date||today(); $('rentMode').value=r.mode||'Cash'; $('rentStatus').value=r.status||calcStatus(r.rentAmount,r.paidAmount); $('rentNote').value=r.note||''; $('rentSubmitBtn').textContent='Update Rent'; $('rentCancelEditBtn')?.classList.remove('hidden'); switchPage('rent'); window.scrollTo({top:0,behavior:'smooth'}); };
window.clearElecEdit = () => { $('electricityForm').reset(); if($('elecId')) $('elecId').value=''; if($('elecSubmitBtn')) $('elecSubmitBtn').textContent='Save Electricity Bill'; $('elecCancelEditBtn')?.classList.add('hidden'); setDefaults(); $('rateUnit').value=8; updateElecTotal(); };
window.editElec = id => { const r=state.electricity[id]; if(!r) return toast('Record not found'); $('elecId').value=id; $('elecTenant').value=r.tenantId||''; $('elecMonth').value=r.month||thisMonth(); $('elecFrom').value=r.periodFrom||firstDayOfMonth(r.month||thisMonth()); $('elecTo').value=r.periodTo||lastDayOfMonth(r.month||thisMonth()); $('prevReading').value=r.prevReading||0; $('currReading').value=r.currReading||0; $('rateUnit').value=r.rate||8; $('elecPaid').value=r.paid||0; $('elecStatus').value=r.status||calcStatus(r.total,r.paid); $('elecNote').value=r.note||''; updateElecTotal(); $('elecSubmitBtn').textContent='Update Electricity Bill'; $('elecCancelEditBtn')?.classList.remove('hidden'); switchPage('electricity'); window.scrollTo({top:0,behavior:'smooth'}); };
window.clearChargeEdit = () => { $('chargeForm').reset(); if($('chargeId')) $('chargeId').value=''; if($('chargeSubmitBtn')) $('chargeSubmitBtn').textContent='Save Charge'; $('chargeCancelEditBtn')?.classList.add('hidden'); setDefaults(); };
window.editCharge = id => { const r=state.charges[id]; if(!r) return toast('Record not found'); $('chargeId').value=id; $('chargeTenant').value=r.tenantId||''; $('chargeType').value=r.type||'Water Bill'; $('chargeAmount').value=r.amount||0; $('chargePaid').value=r.paid||0; $('chargeDate').value=r.date||today(); $('chargeStatus').value=r.status||calcStatus(r.amount,r.paid); $('chargeNote').value=r.note||''; $('chargeSubmitBtn').textContent='Update Charge'; $('chargeCancelEditBtn')?.classList.remove('hidden'); switchPage('charges'); window.scrollTo({top:0,behavior:'smooth'}); };

window.deleteItem = async (type,id) => { if(confirm('Delete this record?')) await dbRemove(refs[type].child(id)); };
function actions(type,id,edit=''){ return `${edit}<button class="danger-btn" onclick="deleteItem('${type}','${id}')">Delete</button>`; }

function renderAll(){ fillSelects(); renderDashboard(); renderTenants(); renderRooms(); renderRent(); renderElec(); renderCharges(); renderReports(); renderBackup(); }
function renderDashboard(){
  const tenants=activeTenants(), rooms=arr(state.rooms), rents=arr(state.rents), elec=arr(state.electricity), charges=arr(state.charges), month=thisMonth();
  $('stRooms').textContent = Math.max(rooms.length, new Set(arr(state.tenants).map(t=>t.room).filter(Boolean)).size);
  $('stOccupied').textContent = tenants.length;
  $('stTenants').textContent = tenants.length;
  $('stRentPaid').textContent = money(sum(rents,'paidAmount'));
  const pending = sum(rents,'pending') + sum(elec,'pending') + sum(charges,'pending');
  $('stPending').textContent = money(pending);
  const monthPaid = sum(rents.filter(r=>r.month===month),'paidAmount') + sum(elec.filter(r=>r.month===month),'paid') + sum(charges.filter(r=>(r.date||'').startsWith(month)),'paid');
  $('stMonthPaid').textContent = money(monthPaid);
  const pendingMap = {};
  [...rents,...elec,...charges].forEach(x => { if((+x.pending||0)>0) pendingMap[x.tenantId]=(pendingMap[x.tenantId]||0)+(+x.pending||0); });
  const ps = Object.entries(pendingMap).sort((a,b)=>b[1]-a[1]).slice(0,8);
  $('pendingSummary').innerHTML = ps.length ? ps.map(([id,p])=>`<div class="mini-item"><b>${safe(tenantName(id))} - Room ${safe(tenantRoom(id))}</b><span>${money(p)}</span></div>`).join('') : '<p class="muted">No pending amount.</p>';
  const statusLabel = (x, totalKey, paidKey) => {
    const total = +x[totalKey] || 0;
    const paid = +x[paidKey] || 0;
    if (x.status) return x.status;
    return calcStatus(total, paid);
  };
  const acts=[
    ...rents.map(r=>({
      t:r.createdAt,
      status:statusLabel(r,'rentAmount','paidAmount'),
      txt:`Rent ${statusLabel(r,'rentAmount','paidAmount')} - ${tenantName(r.tenantId)} / Room ${tenantRoom(r.tenantId)} | ${periodText(r.periodFrom,r.periodTo)} | Paid ${money(r.paidAmount)} | Pending ${money(r.pending)}`
    })),
    ...elec.map(r=>({
      t:r.createdAt,
      status:statusLabel(r,'total','paid'),
      txt:`Electricity ${statusLabel(r,'total','paid')} - ${tenantName(r.tenantId)} / Room ${tenantRoom(r.tenantId)} | ${periodText(r.periodFrom,r.periodTo)} | Paid ${money(r.paid)} | Pending ${money(r.pending)}`
    })),
    ...charges.map(r=>({
      t:r.createdAt,
      status:statusLabel(r,'amount','paid'),
      txt:`${r.type || 'Other Bill'} ${statusLabel(r,'amount','paid')} - ${tenantName(r.tenantId)} / Room ${tenantRoom(r.tenantId)} | Paid ${money(r.paid)} | Pending ${money(r.pending)}`
    }))
  ].sort((a,b)=>(b.t||'').localeCompare(a.t||'')).slice(0,15);
  $('recentActivity').innerHTML = acts.length ? acts.map(a=>`<div class="activity-item"><b>${safe(a.txt)}</b><span><span class="badge ${safe(a.status)}">${safe(a.status)}</span><span class="muted"> ${a.t ? new Date(a.t).toLocaleString('en-IN') : '-'}</span></span></div>`).join('') : '<p class="muted">No activity yet.</p>';
}
function query(id){ return ($(id)?.value||'').toLowerCase(); }
['tenantSearch','roomSearch','rentSearch','elecSearch','chargeSearch','reportMonth','reportTenant'].forEach(id=>$(id)?.addEventListener('input', renderAll));
['reportTenant'].forEach(id=>$(id)?.addEventListener('change', renderAll));
function renderTenants(){ const q=query('tenantSearch'); const rows=arr(state.tenants).filter(t=>JSON.stringify(t).toLowerCase().includes(q)).sort((a,b)=>String(a.room).localeCompare(String(b.room))).map(t=>`<tr><td>${safe(t.name)}</td><td>${safe(t.room)}</td><td>${safe(t.mobile||'-')}</td><td>${money(t.rent)}</td><td>${money(t.deposit)}</td><td><span class="badge ${safe(t.status)}">${safe(t.status)}</span></td><td>${actions('tenants',t.id,`<button class="ghost-btn" onclick="editTenant('${t.id}')">Edit</button> `)}</td></tr>`); $('tenantTable').innerHTML = rows.join('') || '<tr><td colspan="7">No tenants found</td></tr>'; }
function renderRooms(){ const q=query('roomSearch'); const rows=arr(state.rooms).filter(r=>JSON.stringify(r).toLowerCase().includes(q)).sort((a,b)=>String(a.no).localeCompare(String(b.no))).map(r=>{ const current=activeTenants().find(t=>String(t.room).toLowerCase()===String(r.no).toLowerCase()); return `<tr><td>${safe(r.no)}</td><td>${safe(r.floor||'-')}</td><td>${money(r.rent)}</td><td><span class="badge ${safe(r.status)}">${safe(r.status)}</span></td><td>${current?safe(current.name):'-'}</td><td>${actions('rooms',r.id,`<button class="ghost-btn" onclick="editRoom('${r.id}')">Edit</button> `)}</td></tr>`; }); $('roomTable').innerHTML = rows.join('') || '<tr><td colspan="6">No rooms found</td></tr>'; }
function renderRent(){ const q=query('rentSearch'); const rows=arr(state.rents).filter(r=>(JSON.stringify(r)+tenantName(r.tenantId)+tenantRoom(r.tenantId)).toLowerCase().includes(q)).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).map(r=>`<tr><td>${safe(tenantName(r.tenantId))}</td><td>${safe(tenantRoom(r.tenantId))}</td><td>${safe(r.month)}</td><td>${safe(periodText(r.periodFrom,r.periodTo))}</td><td>${money(r.rentAmount)}</td><td>${money(r.paidAmount)}</td><td>${money(r.pending)}</td><td><span class="badge ${safe(r.status)}">${safe(r.status)}</span></td><td><button class="ghost-btn" onclick="showReceipt('rent','${r.id}')">View</button></td><td>${actions('rents',r.id,`<button class="ghost-btn" onclick="editRent('${r.id}')">Edit</button> `)}</td></tr>`); $('rentTable').innerHTML = rows.join('') || '<tr><td colspan="10">No rent records</td></tr>'; }
function renderElec(){ const q=query('elecSearch'); const rows=arr(state.electricity).filter(r=>(JSON.stringify(r)+tenantName(r.tenantId)+tenantRoom(r.tenantId)).toLowerCase().includes(q)).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).map(r=>`<tr><td>${safe(tenantName(r.tenantId))}</td><td>${safe(tenantRoom(r.tenantId))}</td><td>${safe(r.month)}</td><td>${safe(periodText(r.periodFrom,r.periodTo))}</td><td>${safe(r.prevReading)} → ${safe(r.currReading)}</td><td>${safe(r.units)}</td><td>${money(r.total)}</td><td>${money(r.paid)}</td><td>${money(r.pending)}</td><td><button class="ghost-btn" onclick="showReceipt('electricity','${r.id}')">View</button></td><td>${actions('electricity',r.id,`<button class="ghost-btn" onclick="editElec('${r.id}')">Edit</button> `)}</td></tr>`); $('elecTable').innerHTML = rows.join('') || '<tr><td colspan="11">No electricity records</td></tr>'; }
function renderCharges(){ const q=query('chargeSearch'); const rows=arr(state.charges).filter(r=>(JSON.stringify(r)+tenantName(r.tenantId)+tenantRoom(r.tenantId)).toLowerCase().includes(q)).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).map(r=>`<tr><td>${safe(tenantName(r.tenantId))}</td><td>${safe(tenantRoom(r.tenantId))}</td><td>${safe(r.type)}</td><td>${money(r.amount)}</td><td>${money(r.paid)}</td><td>${money(r.pending)}</td><td><span class="badge ${safe(r.status)}">${safe(r.status)}</span></td><td><button class="ghost-btn" onclick="showReceipt('charges','${r.id}')">View</button></td><td>${actions('charges',r.id,`<button class="ghost-btn" onclick="editCharge('${r.id}')">Edit</button> `)}</td></tr>`); $('chargeTable').innerHTML = rows.join('') || '<tr><td colspan="9">No charges</td></tr>'; }
function filterList(list, monthKey, paidKey){ const m=$('reportMonth').value, tid=$('reportTenant').value; return list.filter(x => (!m || String(x[monthKey] || x.date || '').startsWith(m)) && (tid==='all' || x.tenantId===tid)); }
function renderReports(){ const rents=filterList(arr(state.rents),'month'), elec=filterList(arr(state.electricity),'month'), charges=filterList(arr(state.charges),'date'); $('rpRent').textContent=money(sum(rents,'paidAmount')); $('rpElec').textContent=money(sum(elec,'paid')); $('rpCharge').textContent=money(sum(charges,'paid')); $('rpPending').textContent=money(sum(rents,'pending')+sum(elec,'pending')+sum(charges,'pending')); const items=[...rents.map(r=>({type:'Rent',name:tenantName(r.tenantId),room:tenantRoom(r.tenantId),amt:r.rentAmount,paid:r.paidAmount,pending:r.pending,date:r.month,period:periodText(r.periodFrom,r.periodTo)})),...elec.map(r=>({type:'Electricity',name:tenantName(r.tenantId),room:tenantRoom(r.tenantId),amt:r.total,paid:r.paid,pending:r.pending,date:r.month,period:periodText(r.periodFrom,r.periodTo)})),...charges.map(r=>({type:r.type,name:tenantName(r.tenantId),room:tenantRoom(r.tenantId),amt:r.amount,paid:r.paid,pending:r.pending,date:r.date}))]; $('reportDetails').innerHTML = items.length ? items.map(x=>`<div class="report-item"><b>${safe(x.type)} - ${safe(x.name)} / Room ${safe(x.room)}</b><span>${safe(x.date)} | ${safe(x.period || '-')} | Total ${money(x.amt)} | Paid ${money(x.paid)} | Pending ${money(x.pending)}</span></div>`).join('') : '<p class="muted">No report data.</p>'; }
$('clearReportBtn').onclick = () => { $('reportMonth').value=''; $('reportTenant').value='all'; renderReports(); };
function renderBackup(){ $('backupBox').value = JSON.stringify(state,null,2); }
$('downloadJsonBtn').onclick = () => { const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`rtx-rent-backup-${today()}.json`; a.click(); URL.revokeObjectURL(a.href); };
$('copyJsonBtn').onclick = async () => { await navigator.clipboard.writeText(JSON.stringify(state,null,2)); toast('JSON copied'); };
let currentReceiptHTML = '';
window.showReceipt = (type,id) => {
  const data = type==='rent' ? state.rents[id] : type==='electricity' ? state.electricity[id] : state.charges[id];
  if(!data) return;

  const tenantData = tenant(data.tenantId);
  const receiptNo = `${type.toUpperCase().slice(0,3)}-${String(id).slice(-6).toUpperCase()}`;
  const generatedAt = new Date().toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' });
  const st = data.status || (type==='rent' ? calcStatus(data.rentAmount, data.paidAmount) : type==='electricity' ? calcStatus(data.total, data.paid) : calcStatus(data.amount, data.paid));

  let title = 'Payment Receipt';
  let particulars = '';
  let total = 0, paid = 0, pending = 0, mode = data.mode || '-';

  if(type==='rent'){
    title = 'Rent Payment Receipt';
    total = +data.rentAmount || 0;
    paid = +data.paidAmount || 0;
    pending = +data.pending || Math.max(total - paid, 0);
    particulars = `
      <tr><td>Rent Month</td><td>${safe(data.month || '-')}</td></tr>
      <tr><td>Rent Period</td><td>${safe(periodText(data.periodFrom,data.periodTo))}</td></tr>
      <tr><td>Monthly Rent</td><td>${money(total)}</td></tr>`;
  } else if(type==='electricity'){
    title = 'Electricity Bill Receipt';
    total = +data.total || 0;
    paid = +data.paid || 0;
    pending = +data.pending || Math.max(total - paid, 0);
    const units = +data.units || Math.max((+data.currReading||0) - (+data.prevReading||0), 0);
    particulars = `
      <tr><td>Bill Month</td><td>${safe(data.month || '-')}</td></tr>
      <tr><td>Bill Period</td><td>${safe(periodText(data.periodFrom,data.periodTo))}</td></tr>
      <tr><td>Meter Reading</td><td>${safe(data.prevReading || 0)} → ${safe(data.currReading || 0)}</td></tr>
      <tr><td>Units Used</td><td>${safe(units)}</td></tr>
      <tr><td>Rate Per Unit</td><td>${money(data.rate || 0)}</td></tr>`;
  } else {
    title = 'Other Charges Receipt';
    total = +data.amount || 0;
    paid = +data.paid || 0;
    pending = +data.pending || Math.max(total - paid, 0);
    particulars = `
      <tr><td>Charge Type</td><td>${safe(data.type || '-')}</td></tr>
      <tr><td>Charge Date</td><td>${safe(data.date || '-')}</td></tr>`;
  }

  currentReceiptHTML = `
    <div class="pro-receipt">
      <div class="receipt-watermark"><img src="assets/rtx-logo-icon.png" alt="RTX"></div>
      <div class="receipt-top">
        <div class="receipt-brand">
          <div class="receipt-logo"><img src="assets/rtx-logo-icon.png" alt="RTX Logo"></div>
          <div>
            <h2>RTX Management</h2>
            <p>Rent & Utility Management System</p>
          </div>
        </div>
        <div class="receipt-meta">
          <span class="status-badge ${safe(st)}">${safe(st)}</span>
          <p><b>Receipt No:</b> ${safe(receiptNo)}</p>
          <p><b>Generated:</b> ${safe(generatedAt)}</p>
        </div>
      </div>

      <div class="receipt-title-box">
        <h1>${safe(title)}</h1>
        <p>This receipt confirms the payment record saved in RTX Management.</p>
      </div>

      <div class="receipt-info-grid">
        <div>
          <h4>Tenant Details</h4>
          <p><b>Name:</b> ${safe(tenantName(data.tenantId))}</p>
          <p><b>Mobile:</b> ${safe(tenantData.mobile || '-')}</p>
          <p><b>Room No:</b> ${safe(tenantRoom(data.tenantId))}</p>
        </div>
        <div>
          <h4>Payment Details</h4>
          <p><b>Payment Mode:</b> ${safe(mode)}</p>
          <p><b>Record Date:</b> ${safe(data.paymentDate || data.date || data.createdAt?.slice(0,10) || '-')}</p>
          <p><b>Note:</b> ${safe(data.note || '-')}</p>
        </div>
      </div>

      <table class="receipt-table">
        <thead><tr><th>Particular</th><th>Details</th></tr></thead>
        <tbody>${particulars}</tbody>
      </table>

      <div class="amount-summary">
        <div><span>Total Amount</span><b>${money(total)}</b></div>
        <div><span>Paid Amount</span><b>${money(paid)}</b></div>
        <div class="pending"><span>Pending Amount</span><b>${money(pending)}</b></div>
      </div>

      <div class="receipt-footer-pro">
        <div>
          <b>Terms / Note</b>
          <p>Computer generated receipt. Please verify tenant, period, payment and pending amount before sharing.</p>
        </div>
        <div class="signature-box">
          <span>Authorized Signature</span>
        </div>
      </div>
    </div>`;
  $('receiptContent').innerHTML = currentReceiptHTML;
  $('receiptModal').classList.remove('hidden');
};
$('closeReceipt').onclick = () => $('receiptModal').classList.add('hidden');

function receiptPrintCSS(){
  return `@page{size:A4;margin:10mm;}
*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
html,body{margin:0!important;padding:0!important;background:#fff!important;color:#111827!important;font-family:Inter,Arial,sans-serif!important;}
.print-shell{width:100%;max-width:794px;margin:0 auto;background:#fff;}
:root{--bg:#070912;--panel:#101522;--panel2:#151b2c;--text:#f7f8ff;--muted:#9ca7c5;--line:#26304a;--pri:#7c3aed;--pri2:#a855f7;--good:#22c55e;--warn:#f59e0b;--bad:#ef4444;--shadow:0 20px 60px rgba(0,0,0,.35)}*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,Arial;background:radial-gradient(circle at top left,#20133d,transparent 36%),var(--bg);color:var(--text)}button,input,select,textarea{font:inherit}button{cursor:pointer;border:0}.hidden{display:none!important}.app{display:flex;min-height:100vh}.sidebar{width:280px;background:rgba(13,18,31,.92);border-right:1px solid var(--line);padding:22px;position:fixed;inset:0 auto 0 0;z-index:20;backdrop-filter:blur(18px)}.brand{display:flex;gap:12px;align-items:center}.brand.big{margin-bottom:26px}.brand-logo{width:46px;height:46px;border-radius:16px;background:linear-gradient(135deg,var(--pri),#06b6d4);display:grid;place-items:center;font-weight:900}.brand h1{font-size:18px;margin:0}.brand p,.muted{margin:3px 0 0;color:var(--muted);font-size:13px}.sidebar nav{display:grid;gap:9px;margin-top:28px}.nav-btn,.logout-btn{padding:13px 14px;border-radius:14px;background:transparent;color:var(--muted);text-align:left;font-weight:700}.nav-btn:hover,.nav-btn.active{background:linear-gradient(135deg,rgba(124,58,237,.28),rgba(168,85,247,.12));color:#fff}.sidebar-footer{position:absolute;bottom:18px;left:22px;right:22px;display:grid;gap:10px;color:var(--muted);font-size:12px}.logout-btn{background:#1b2236;text-align:center}.main{margin-left:280px;width:calc(100% - 280px);padding:22px}.topbar{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:22px}.topbar h2{margin:0;font-size:26px}.menu-btn{display:none}.top-actions,.section-head,.action-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.primary-btn,.ghost-btn,.danger-btn{border-radius:13px;padding:11px 15px;font-weight:800;color:#fff}.primary-btn{background:linear-gradient(135deg,var(--pri),var(--pri2));box-shadow:0 10px 25px rgba(124,58,237,.25)}.ghost-btn{background:#1b2236;border:1px solid var(--line)}.danger-btn{background:rgba(239,68,68,.14);border:1px solid rgba(239,68,68,.35);color:#fecaca}.page{display:none}.page.active{display:block}.stats-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;margin-bottom:16px}.stat-card,.panel,.login-card{background:linear-gradient(180deg,rgba(21,27,44,.96),rgba(14,19,32,.96));border:1px solid var(--line);border-radius:22px;padding:18px;box-shadow:var(--shadow)}.stat-card p{margin:0;color:var(--muted);font-size:13px}.stat-card h3{margin:8px 0 0;font-size:25px}.stat-card.warning h3{color:#fbbf24}.panel{margin-bottom:16px}.panel h3{margin:0 0 5px}.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px}.form-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:16px}.form-grid.compact{grid-template-columns:repeat(3,1fr)}label{display:grid;gap:7px;color:#cdd5ee;font-size:13px;font-weight:700}input,select,textarea{width:100%;background:#0b1020;color:#fff;border:1px solid var(--line);border-radius:13px;padding:12px;outline:none}input:focus,select:focus,textarea:focus{border-color:var(--pri2)}textarea{min-height:86px;resize:vertical}.full{grid-column:1/-1}.search{max-width:320px}.table-wrap{overflow:auto;margin-top:14px}table{width:100%;border-collapse:collapse;min-width:850px}th,td{padding:13px;border-bottom:1px solid var(--line);text-align:left;font-size:13px;vertical-align:middle}th{color:#c4cdf0;background:#11182b;position:sticky;top:0}.badge{display:inline-block;padding:5px 9px;border-radius:999px;background:#1f2937;color:#e5e7eb;font-size:12px;font-weight:800}.badge.Paid,.badge.Active,.badge.Occupied{background:rgba(34,197,94,.16);color:#86efac}.badge.Pending,.badge.Unpaid,.badge.Maintenance{background:rgba(245,158,11,.16);color:#fde68a}.badge.Left,.badge.Rejected{background:rgba(239,68,68,.16);color:#fecaca}.badge.Partial,.badge.Processing{background:rgba(59,130,246,.16);color:#bfdbfe}.activity-list,.mini-list,.report-list{display:grid;gap:10px}.activity-item,.mini-item,.report-item{padding:13px;border:1px solid var(--line);border-radius:15px;background:#0b1020;display:flex;justify-content:space-between;gap:12px}.toast{position:fixed;right:22px;bottom:22px;background:#111827;border:1px solid var(--line);padding:13px 16px;border-radius:14px;opacity:0;transform:translateY(10px);transition:.2s;z-index:100}.toast.show{opacity:1;transform:translateY(0)}.login-screen{min-height:100vh;display:grid;place-items:center;padding:22px}.login-card{width:min(460px,100%)}.login-form{display:grid;gap:14px}.backup-box{width:100%;min-height:360px;margin-top:16px;font-family:monospace}.modal{position:fixed;inset:0;background:rgba(0,0,0,.7);display:grid;place-items:center;z-index:200;padding:20px}.receipt-card{width:min(560px,100%);background:#fff;color:#111;border-radius:18px;padding:24px;position:relative}.receipt-card h2,.receipt-card h3{margin:0}.receipt-row{display:flex;justify-content:space-between;border-bottom:1px dashed #ccc;padding:9px 0}.close-btn{position:absolute;right:12px;top:10px;background:#eee;border-radius:50%;width:34px;height:34px;font-size:22px}.receipt-card .primary-btn{margin-top:18px;width:100%}@media print{body{background:#fff;color:#111}.sidebar,.topbar,.toast,.close-btn,#printReceiptBtn{display:none!important}.main{margin:0;width:100%;padding:0}.panel,.stat-card{box-shadow:none;border:1px solid #ddd;background:#fff;color:#111}.modal{position:static;background:#fff;padding:0}.receipt-card{box-shadow:none;width:100%}.page{display:none}.page.active{display:block}}@media(max-width:1100px){.stats-grid{grid-template-columns:repeat(3,1fr)}.form-grid{grid-template-columns:repeat(2,1fr)}.grid-2{grid-template-columns:1fr}}@media(max-width:760px){.sidebar{transform:translateX(-105%);transition:.25s}.sidebar.open{transform:translateX(0)}.main{margin-left:0;width:100%;padding:14px}.menu-btn{display:block;background:#1b2236;color:#fff;border-radius:12px;padding:11px 14px}.topbar{align-items:flex-start}.top-actions{width:100%}.stats-grid{grid-template-columns:repeat(2,1fr)}.form-grid,.form-grid.compact{grid-template-columns:1fr}.search{max-width:100%}.stat-card h3{font-size:20px}.topbar{flex-wrap:wrap}.activity-item,.mini-item,.report-item{display:grid}}@media(max-width:420px){.stats-grid{grid-template-columns:1fr}}

/* Professional Receipt Design */
.receipt-card{width:min(820px,100%);padding:0;border-radius:22px;overflow:hidden;background:#f8fafc;color:#111827;box-shadow:0 30px 90px rgba(0,0,0,.45)}
#receiptContent{padding:0}.pro-receipt{position:relative;background:#fff;padding:34px;overflow:hidden}.receipt-watermark{position:absolute;right:28px;bottom:18px;font-size:110px;font-weight:900;color:rgba(15,23,42,.035);letter-spacing:-8px;pointer-events:none}.receipt-top{display:flex;justify-content:space-between;gap:22px;border-bottom:3px solid #111827;padding-bottom:22px}.receipt-brand{display:flex;align-items:center;gap:15px}.receipt-logo img{width:100%;height:100%;object-fit:cover;display:block}.receipt-logo{width:64px;height:64px;border-radius:18px;background:linear-gradient(135deg,#111827,#7c3aed);color:#fff;display:grid;place-items:center;font-weight:900;font-size:18px}.receipt-brand h2{margin:0;font-size:28px;letter-spacing:-.5px;color:#111827}.receipt-brand p,.receipt-title-box p,.receipt-meta p,.receipt-info-grid p,.receipt-footer-pro p{margin:4px 0;color:#475569}.receipt-meta{text-align:right;min-width:220px}.status-badge{display:inline-block;padding:7px 14px;border-radius:999px;font-weight:900;font-size:12px;text-transform:uppercase;margin-bottom:8px;border:1px solid #cbd5e1;background:#e2e8f0;color:#334155}.status-badge.Paid{background:#dcfce7;color:#166534;border-color:#86efac}.status-badge.Pending,.status-badge.Unpaid{background:#fef3c7;color:#92400e;border-color:#fcd34d}.status-badge.Partial,.status-badge.Processing{background:#dbeafe;color:#1e40af;border-color:#93c5fd}.status-badge.Rejected{background:#fee2e2;color:#991b1b;border-color:#fca5a5}.receipt-title-box{margin:26px 0 18px;padding:18px 20px;border-radius:18px;background:linear-gradient(135deg,#f1f5f9,#eef2ff);border:1px solid #e2e8f0}.receipt-title-box h1{margin:0;font-size:25px;color:#111827}.receipt-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}.receipt-info-grid>div{border:1px solid #e2e8f0;border-radius:16px;padding:16px;background:#f8fafc}.receipt-info-grid h4{margin:0 0 10px;color:#111827;font-size:15px}.receipt-table{width:100%;border-collapse:collapse;min-width:0;margin:12px 0 20px;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden}.receipt-table th{position:static;background:#111827;color:#fff;padding:13px 16px}.receipt-table td{color:#111827;padding:13px 16px;border-bottom:1px solid #e2e8f0;font-size:14px}.receipt-table tr:last-child td{border-bottom:0}.amount-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:20px 0}.amount-summary div{border:1px solid #e2e8f0;background:#f8fafc;border-radius:18px;padding:16px}.amount-summary span{display:block;color:#64748b;font-size:13px;font-weight:800}.amount-summary b{display:block;margin-top:6px;font-size:22px;color:#111827}.amount-summary .pending{background:#fff7ed;border-color:#fed7aa}.amount-summary .pending b{color:#c2410c}.receipt-footer-pro{display:grid;grid-template-columns:1.4fr .8fr;gap:18px;align-items:end;border-top:1px dashed #94a3b8;padding-top:22px;margin-top:12px}.signature-box{height:90px;border:1px dashed #94a3b8;border-radius:16px;display:flex;align-items:end;justify-content:center;padding:12px;color:#64748b;font-weight:800}.receipt-card #printReceiptBtn{margin:0;border-radius:0;width:100%;padding:15px}.receipt-card .close-btn{z-index:5;right:14px;top:14px;background:#111827;color:#fff}
@media(max-width:720px){.receipt-top,.receipt-info-grid,.receipt-footer-pro{grid-template-columns:1fr;display:grid}.receipt-meta{text-align:left}.amount-summary{grid-template-columns:1fr}.pro-receipt{padding:22px}.receipt-brand h2{font-size:22px}}
@media print{.sidebar,.topbar,.toast,.close-btn,#printReceiptBtn,.no-print{display:none!important}.modal{position:static!important;background:#fff!important;padding:0!important;display:block!important}.receipt-card{width:100%!important;max-width:100%!important;box-shadow:none!important;border-radius:0!important;background:#fff!important}.pro-receipt{padding:24px!important}.amount-summary div,.receipt-info-grid>div,.receipt-title-box{break-inside:avoid}.receipt-table tr{break-inside:avoid}}

/* ===== Receipt v3: scroll + professional compact layout ===== */
#receiptModal.modal{
  place-items:start center !important;
  align-items:start !important;
  overflow-y:auto !important;
  overflow-x:hidden !important;
  padding:28px 14px !important;
}
.receipt-card{
  width:min(860px,100%) !important;
  max-height:none !important;
  margin:0 auto 40px !important;
  border-radius:18px !important;
  overflow:visible !important;
  background:#ffffff !important;
  color:#101828 !important;
  box-shadow:0 30px 100px rgba(0,0,0,.55) !important;
}
#receiptContent{
  max-height:none !important;
  overflow:visible !important;
}
.receipt-card .close-btn{
  position:sticky !important;
  float:right !important;
  top:12px !important;
  right:12px !important;
  z-index:20 !important;
  margin:10px 10px -44px auto !important;
}
.receipt-card #printReceiptBtn{
  position:sticky !important;
  bottom:0 !important;
  z-index:12 !important;
  border-radius:0 0 18px 18px !important;
  background:#111827 !important;
  color:#fff !important;
  border-top:1px solid #e5e7eb !important;
}
.pro-receipt{
  padding:0 !important;
  overflow:hidden !important;
  border:1px solid #d0d5dd !important;
  border-radius:18px 18px 0 0 !important;
  background:#fff !important;
  color:#101828 !important;
}
.receipt-watermark{display:none !important;}
.receipt-top{
  background:linear-gradient(135deg,#111827,#1f2937) !important;
  color:#fff !important;
  padding:24px 28px !important;
  border-bottom:0 !important;
  display:flex !important;
  align-items:flex-start !important;
  justify-content:space-between !important;
  gap:20px !important;
}
.receipt-logo{
  background:#fff !important;
  color:#111827 !important;
  border-radius:12px !important;
  width:54px !important;
  height:54px !important;
}
.receipt-brand h2{color:#fff !important;font-size:26px !important;}
.receipt-brand p{color:#d1d5db !important;}
.receipt-meta{text-align:right !important;min-width:220px !important;}
.receipt-meta p{color:#e5e7eb !important;margin:5px 0 !important;}
.status-badge{
  background:#fff !important;color:#111827 !important;border:0 !important;
  padding:7px 15px !important;border-radius:999px !important;margin-bottom:8px !important;
}
.status-badge.Paid{background:#dcfce7 !important;color:#166534 !important;}
.status-badge.Pending,.status-badge.Unpaid{background:#fef3c7 !important;color:#92400e !important;}
.status-badge.Partial,.status-badge.Processing{background:#dbeafe !important;color:#1e40af !important;}
.status-badge.Rejected{background:#fee2e2 !important;color:#991b1b !important;}
.receipt-title-box{
  margin:0 !important;
  padding:20px 28px !important;
  border:0 !important;
  border-radius:0 !important;
  background:#f9fafb !important;
  border-bottom:1px solid #e5e7eb !important;
}
.receipt-title-box h1{font-size:23px !important;color:#111827 !important;}
.receipt-title-box p{color:#667085 !important;margin-top:5px !important;}
.receipt-info-grid{
  padding:22px 28px 0 !important;
  margin:0 !important;
  display:grid !important;
  grid-template-columns:1fr 1fr !important;
  gap:16px !important;
}
.receipt-info-grid>div{
  border:1px solid #eaecf0 !important;
  border-radius:14px !important;
  background:#fff !important;
  padding:16px !important;
}
.receipt-info-grid h4{color:#111827 !important;margin-bottom:10px !important;font-size:14px !important;text-transform:uppercase;letter-spacing:.04em;}
.receipt-info-grid p{color:#344054 !important;margin:6px 0 !important;}
.receipt-table{
  width:calc(100% - 56px) !important;
  margin:22px 28px !important;
  border:1px solid #eaecf0 !important;
  border-radius:14px !important;
  overflow:hidden !important;
  min-width:0 !important;
}
.receipt-table th{
  background:#f2f4f7 !important;
  color:#344054 !important;
  text-transform:uppercase !important;
  letter-spacing:.04em !important;
  font-size:12px !important;
  padding:13px 16px !important;
}
.receipt-table td{
  color:#101828 !important;
  padding:13px 16px !important;
  border-bottom:1px solid #eaecf0 !important;
}
.amount-summary{
  margin:0 28px 22px !important;
  padding:16px !important;
  display:grid !important;
  grid-template-columns:repeat(3,1fr) !important;
  gap:12px !important;
  background:#f9fafb !important;
  border:1px solid #eaecf0 !important;
  border-radius:16px !important;
}
.amount-summary div{
  padding:14px !important;
  background:#fff !important;
  border:1px solid #eaecf0 !important;
  border-radius:13px !important;
}
.amount-summary span{font-size:12px !important;text-transform:uppercase !important;letter-spacing:.04em !important;color:#667085 !important;}
.amount-summary b{font-size:24px !important;color:#111827 !important;}
.amount-summary .pending{background:#fff7ed !important;border-color:#fed7aa !important;}
.receipt-footer-pro{
  margin:0 !important;
  padding:20px 28px 24px !important;
  display:grid !important;
  grid-template-columns:1.2fr .8fr !important;
  gap:18px !important;
  border-top:1px dashed #98a2b3 !important;
  background:#fff !important;
}
.receipt-footer-pro p{color:#667085 !important;}
.signature-box{height:72px !important;border-radius:12px !important;background:#f9fafb !important;}
@media(max-width:720px){
  #receiptModal.modal{padding:12px 8px !important;}
  .receipt-top,.receipt-info-grid,.receipt-footer-pro{grid-template-columns:1fr !important;display:grid !important;}
  .receipt-top{padding:20px !important;}
  .receipt-meta{text-align:left !important;}
  .receipt-title-box{padding:18px 20px !important;}
  .receipt-info-grid{padding:18px 20px 0 !important;grid-template-columns:1fr !important;}
  .receipt-table{width:calc(100% - 40px) !important;margin:18px 20px !important;}
  .amount-summary{grid-template-columns:1fr !important;margin:0 20px 18px !important;}
  .receipt-footer-pro{padding:18px 20px 22px !important;}
}
@media print{
  #receiptModal.modal{overflow:visible !important;padding:0 !important;}
  .receipt-card{margin:0 !important;box-shadow:none !important;}
  .receipt-card #printReceiptBtn,.receipt-card .close-btn{display:none !important;}
  .pro-receipt{border-radius:0 !important;border:0 !important;}
}

@media print{body{background:#fff!important} .print-shell{max-width:none!important} .pro-receipt{border:0!important;border-radius:0!important}}`;
}

function printHTML(title, html, css){
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.setAttribute('aria-hidden','true');
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><base href="${location.href}"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(title)}</title><style>${css}</style></head><body>${html}</body></html>`);
  doc.close();
  setTimeout(() => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } finally {
      setTimeout(() => frame.remove(), 1200);
    }
  }, 500);
}

function printProfessionalReceipt(){
  if(!currentReceiptHTML){ toast('Receipt open nahi hai'); return; }
  printHTML('RTX Receipt', `<div class="print-shell">${currentReceiptHTML}</div>`, receiptPrintCSS());
}

function printReportOnly(){
  const html = `<div class="report-print"><div class="report-head"><img src="assets/rtx-logo-icon.png" alt="RTX Logo"><div><h1>RTX Rent Management Report</h1><p>Generated: ${safe(new Date().toLocaleString('en-IN'))}</p></div></div><div class="summary"><div>Rent Paid: <b>${safe($('rpRent').textContent)}</b></div><div>Electricity Paid: <b>${safe($('rpElec').textContent)}</b></div><div>Other Paid: <b>${safe($('rpCharge').textContent)}</b></div><div>Pending: <b>${safe($('rpPending').textContent)}</b></div></div>${$('reportDetails').innerHTML}</div>`;
  const css = `@page{size:A4;margin:12mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}body{font-family:Arial,sans-serif;color:#111;margin:0}.report-print{max-width:800px;margin:auto}.report-head{display:flex;align-items:center;gap:14px;border-bottom:2px solid #111827;padding-bottom:14px;margin-bottom:14px}.report-head img{width:58px;height:58px;border-radius:14px;object-fit:cover}.report-head h1{margin:0 0 6px}.report-head p{margin:0;color:#555}.summary{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0}.summary div,.report-item{border:1px solid #ddd;border-radius:10px;padding:12px;margin-bottom:10px}.report-item{display:block}.report-item b{display:block;margin-bottom:5px}`;
  printHTML('RTX Report', html, css);
}

function printActivePage(){
  const active = document.querySelector('.page.active');
  if(active && active.id === 'reports') return printReportOnly();
  if(currentReceiptHTML && !$('receiptModal').classList.contains('hidden')) return printProfessionalReceipt();
  toast('Receipt open karke Print Receipt dabao, ya Reports page print karo.');
}

$('printReceiptBtn').onclick = printProfessionalReceipt;
