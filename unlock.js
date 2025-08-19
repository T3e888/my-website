// unlock.js — ใช้พอยท์ปลดล็อกการ์ดอีเวนต์แบบสุ่ม (21–24), ไม่ซ้ำ
const auth = firebase.auth();
const db   = firebase.firestore();

const POOL = ['card21','card22','card23','card24'];
const COST = 5;

const $ = id => document.getElementById(id);

/* ===== Sidebar (เหมือนหน้าอื่น ๆ) ===== */
function setupSidebar(){
  const toggleBtn = $("menu-toggle");
  const sidebar   = $("sidebar");
  const overlay   = $("overlay");
  const closeBtn  = $("close-sidebar");
  const logout    = $("logout-link");

  const open  = ()=>{ sidebar.classList.add("open"); overlay.classList.add("active"); };
  const close = ()=>{ sidebar.classList.remove("open"); overlay.classList.remove("active"); };

  toggleBtn?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  overlay?.addEventListener("click", close);
  logout?.addEventListener("click", (e)=>{ e.preventDefault(); auth.signOut().then(()=>location.href="login.html"); });

  document.querySelectorAll("#sidebar .menu-item a").forEach(a=>{
    if (!a.closest("#logout-link")) a.addEventListener("click", close);
  });
}

/* ===== Modal ===== */
function showModal(html, cb){
  const m = $('modal'); if(!m) return;
  m.innerHTML = `<div class="modal-content">${html}<br><button class="ok">ตกลง</button></div>`;
  m.classList.add('active');
  m.querySelector('.ok').onclick = ()=>{ m.classList.remove('active'); cb?.(); };
}

/* ===== Render mini grid ===== */
function renderGrid(cards){
  const owned = new Set(Array.isArray(cards) ? cards : []);
  $('eventGrid').innerHTML = POOL.map(c=>{
    const n = c.replace('card','การ์ด ');
    const has = owned.has(c);
    const cls = has ? 'owned' : 'locked';
    return `<div class="tile ${cls}">
      <img src="assets/cards/${c}.png" alt="${n}">
      <div class="cap">${n}${has?' ✓':''}</div>
    </div>`;
  }).join('');
}

/* ===== Start ===== */
auth.onAuthStateChanged(async user=>{
  if(!user){ location.href='login.html'; return; }
  setupSidebar();

  const uref = db.collection('users').doc(user.uid);
  // สร้างเอกสารครั้งแรก (ไม่ทับ points/cards เดิม)
  const first = await uref.get();
  if(!first.exists){
    await uref.set({
      username: (user.email||"").split("@")[0] || "user",
      points: 0,
      cards: []
    }, { merge: true });
  }

  // อัปเดตคะแนน/การ์ดแบบเรียลไทม์
  let busy = false;
  $('costPill').textContent = `${COST} 🧠`;

  uref.onSnapshot(snap=>{
    const d = snap.exists ? (snap.data()||{}) : {};
    const points = Number(d.points||0);
    const cards  = Array.isArray(d.cards) ? d.cards : [];

    $('pointsValue').textContent = points;
    const ownedEvent = POOL.filter(c=>cards.includes(c));
    $('ownedCount').textContent = ownedEvent.length;

    renderGrid(cards);

    const allUnlocked = ownedEvent.length === POOL.length;
    $('unlockBtn').disabled = busy || (points < COST) || allUnlocked;

    $('hint').textContent =
      allUnlocked ? 'คุณมีการ์ดอีเวนต์ครบทุกใบแล้ว' :
      (points < COST) ? `ต้องการพอยท์อย่างน้อย ${COST} เพื่อปลดล็อก` : '';
  }, err=>{
    console.warn('users doc listener error:', err);
  });

  $('unlockBtn').onclick = async ()=>{
    if(busy) return;
    busy = true; $('unlockBtn').disabled = true;

    try{
      const picked = await db.runTransaction(async tx=>{
        const snap = await tx.get(uref);
        const d = snap.exists ? (snap.data()||{}) : {};
        const points = Number(d.points||0);
        const cards  = Array.isArray(d.cards) ? d.cards : [];

        if(points < COST) throw new Error('NOT_ENOUGH_POINTS');

        const options = POOL.filter(c=>!cards.includes(c));
        if(options.length === 0) throw new Error('ALL_UNLOCKED');

        const choice = options[Math.floor(Math.random()*options.length)];

        tx.update(uref, {
          points: firebase.firestore.FieldValue.increment(-COST),
          cards:  firebase.firestore.FieldValue.arrayUnion(choice)
        });

        return choice;
      });

      showModal(`
        🎉 คุณปลดล็อก <b>${picked.replace('card','การ์ด ')}</b> แล้ว!<br>
        <img src="assets/cards/${picked}.png" alt="${picked}" style="max-width:200px;margin-top:10px;border-radius:12px;">
      `);
    }catch(e){
      if(e?.message==='NOT_ENOUGH_POINTS'){ showModal('พอยท์ไม่เพียงพอ'); }
      else if(e?.message==='ALL_UNLOCKED'){ showModal('คุณมีการ์ดอีเวนต์ครบทุกใบแล้ว'); }
      else { showModal('❌ ข้อผิดพลาด: ' + (e?.message||e)); }
    }finally{
      busy = false;
      // ปุ่มจะถูกรีเฟรชสภาพผ่าน onSnapshot อีกที
    }
  };
});
