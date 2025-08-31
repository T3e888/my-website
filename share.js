// share.js — pre-logo, fully clickable tiles + Thai modal messages

const auth = firebase.auth();
const db   = firebase.firestore();

const $ = (id) => document.getElementById(id);
const DAY = 24 * 60 * 60 * 1000;
const BORROW_MS = 3 * DAY;

let currentUid = null;
let ownedCardsCache = [];

/* ---------- Sidebar ---------- */
(function setupSidebar(){
  $("menu-toggle")?.addEventListener("click", ()=>{
    $("sidebar").classList.add("open"); $("overlay").classList.add("active");
  });
  $("close-sidebar")?.addEventListener("click", ()=>{
    $("sidebar").classList.remove("open"); $("overlay").classList.remove("active");
  });
  $("overlay")?.addEventListener("click", ()=>{
    $("sidebar").classList.remove("open"); $("overlay").classList.remove("active");
  });
  $("logout-link")?.addEventListener("click", (e)=>{
    e.preventDefault(); auth.signOut().then(()=>location.href="login.html");
  });
})();

/* ---------- Modal ---------- */
function showModal(msg, cb){
  const modal = $("modal");
  modal.innerHTML = `<div class="modal-content">${msg}<br><button class="ok">ตกลง</button></div>`;
  modal.classList.add("active");
  modal.querySelector(".ok").onclick = ()=>{ modal.classList.remove("active"); cb?.(); };
}

/* ---------- Helpers ---------- */
async function getUidByUsername(username){
  const uname = (username||"").trim().toLowerCase();
  if (!uname) return null;
  const snap = await db.collection("usernames").doc(uname).get();
  return snap.exists ? (snap.data().uid || null) : null;
}
async function getUsernameByUid(uid){
  try{
    const s = await db.collection("users").doc(uid).get();
    return (s.exists && s.data().username) ? s.data().username : uid.slice(0,6);
  }catch{ return uid.slice(0,6); }
}

/* ---------- ensure *my* username mapping exists on login ---------- */
/* (keeps your rules happy and makes recipient lookup reliable) */
async function ensureSelfUsernameMapping(user){
  const uref = db.collection("users").doc(user.uid);
  const snap = await uref.get();
  const fromEmail = (user.email || "").split("@")[0] || "user";
  const base = (snap.exists && snap.data().username) ? String(snap.data().username) : String(fromEmail);
  let uname = base.trim().toLowerCase().replace(/[^a-z0-9._-]/g,"");
  if (uname.length < 3) uname = `user-${user.uid.slice(0,4).toLowerCase()}`;

  try {
    await db.collection("usernames").doc(uname).set({ uid: user.uid, username: uname }, { merge: true });
  } catch (e) {
    // Likely taken by someone else per rules → suffix with -xxxx, then persist back to /users
    const fallback = `${uname}-${user.uid.slice(0,4).toLowerCase()}`;
    await db.collection("usernames").doc(fallback).set({ uid: user.uid, username: fallback }, { merge: true });
    await uref.set({ username: fallback }, { merge: true });
  }
}

/* ---------- Owned grid (click-to-share) ---------- */
function renderOwnedCards(cards){
  const grid = $("ownedGrid");
  grid.innerHTML = "";
  if (!cards || !cards.length){
    grid.innerHTML = `<div class="hint">คุณยังไม่มีการ์ดเป็นเจ้าของ</div>`;
    return;
  }
  const sorted = cards.slice().sort((a,b)=> Number(a.replace('card','')) - Number(b.replace('card','')));
  grid.innerHTML = sorted.map(cid=>{
    const n = Number(cid.replace('card',''));
    return `
      <div class="cardTile" data-id="${cid}" title="แตะเพื่อส่ง">
        <img class="cover" src="assets/cards/${cid}.png"
             onerror="this.onerror=null;this.src='assets/cards/${cid}.jpg'">
        <div class="cap">การ์ด ${n}</div>
      </div>`;
  }).join("");

  // event delegation (one handler)
  grid.onclick = (e)=>{
    const tile = e.target.closest(".cardTile");
    if (!tile) return;
    onShareClick(currentUid, tile.dataset.id);
  };
}

/* ---------- Create borrow doc ---------- */
async function createBorrowDoc(toUid, fromUid, cardId){
  const untilTs = firebase.firestore.Timestamp.fromDate(new Date(Date.now() + BORROW_MS));
  const ref = db.collection("users").doc(toUid).collection("shared").doc(cardId);
  await ref.set({
    cardId,
    fromUid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    until: untilTs
  });
}

/* ---------- Share flow + user messages (NO pre-read of shared doc) ---------- */
async function onShareClick(fromUid, cardId){
  const username = ($("toUser").value || "").trim().toLowerCase();
  if (!username){ showModal("กรุณากรอกชื่อผู้รับ"); return; }

  try{
    // 1) resolve @username -> uid
    const toUid = await getUidByUsername(username);
    if (!toUid){ showModal("ไม่พบบัญชีผู้รับ กรุณาให้ผู้รับบันทึกชื่อผู้ใช้ในหน้าโปรไฟล์"); return; }
    if (toUid === fromUid){ showModal("ไม่สามารถแบ่งปันการ์ดให้ตัวเองได้"); return; }

    // 2) sender must own the card
    if (!ownedCardsCache.includes(cardId)){
      showModal("สามารถแบ่งปันได้เฉพาะการ์ดที่คุณเป็นเจ้าของเท่านั้น"); return;
    }

    // 3) receiver already owns?
    const toDoc = await db.collection("users").doc(toUid).get();
    const toCards = (toDoc.exists && Array.isArray(toDoc.data().cards)) ? toDoc.data().cards : [];
    if (toCards.includes(cardId)){ showModal("ผู้รับเป็นเจ้าของการ์ดนี้อยู่แล้ว"); return; }

    // 4) just try to create the borrow doc (rules will block duplicates)
    try{
      await createBorrowDoc(toUid, fromUid, cardId);
    }catch(e){
      const code = e?.code || "";
      if (code === "permission-denied"){
        showModal(
          "❌ แบ่งปันไม่สำเร็จ:<br>" +
          "• ผู้รับกำลังยืมการ์ดนี้อยู่แล้ว (ซ้ำ) หรือ<br>" +
          "• โครงสร้างข้อมูลไม่ตรงกับเงื่อนไขความปลอดภัย"
        );
      }else{
        showModal(`❌ แบ่งปันไม่สำเร็จ:<br><small>${code} ${e?.message||e}</small>`);
      }
      return;
    }

    // 5) best-effort log
    try{
      await db.collection("shareInbox").add({
        fromUid, toUid, cardId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: "borrowed"
      });
    }catch{}

    showModal(`✅ แบ่งปัน <b>${cardId}</b> ให้ <b>@${username}</b> เรียบร้อยแล้ว`);
  }catch(e){
    showModal(`❌ แบ่งปันไม่สำเร็จ:<br><small>${e?.code||""} ${e?.message||e}</small>`);
  }
}

/* ---------- Borrowed countdown + log ---------- */
function watchBorrowed(uid){
  const list = $("borrowedList");
  list.innerHTML = `<div class="hint">กำลังโหลด…</div>`;
  let timer = null;
  const items = new Map();

  db.collection("users").doc(uid).collection("shared").onSnapshot(async (snap)=>{
    items.clear(); list.innerHTML = "";
    if (snap.empty){
      list.innerHTML = `<div class="hint">ตอนนี้คุณยังไม่ได้ยืมการ์ดใด ๆ</div>`;
      if (timer){ clearInterval(timer); timer = null; }
      return;
    }
    for (const d of snap.docs){
      const v = d.data();
      const cardId = v.cardId;
      const until  = v.until?.toDate ? v.until.toDate().getTime() : (Date.now() + BORROW_MS);
      const fromName = await getUsernameByUid(v.fromUid);
      const el = document.createElement("div");
      el.className = "borrowed";
      el.innerHTML = `
        <img class="thumb" src="assets/cards/${cardId}.png"
             onerror="this.onerror=null;this.src='assets/cards/${cardId}.jpg'">
        <div class="meta">
          <div><b>${cardId}</b> — ยืมมาจาก <b>@${fromName}</b></div>
          <div class="timer" data-card="${cardId}">—</div>
        </div>`;
      list.appendChild(el);
      items.set(cardId, { el, until });
    }

    if (timer) clearInterval(timer);
    timer = setInterval(async ()=>{
      const now = Date.now();
      for (const [cid, obj] of items){
        const remain = obj.until - now;
        const tEl = obj.el.querySelector(`.timer[data-card="${cid}"]`);
        if (!tEl) continue;
        if (remain > 0){
          const s = Math.floor(remain/1000);
          const h  = String(Math.floor(s/3600)).padStart(2,'0');
          const m  = String(Math.floor((s%3600)/60)).padStart(2,'0');
          const ss = String(s%60).padStart(2,'0');
          tEl.textContent = `เวลาคงเหลือ: ${h}:${m}:${ss}`;
        }else{
          tEl.textContent = "กำลังเปลี่ยนสถานะเป็นเจ้าของ…";
          items.delete(cid);
          await db.runTransaction(async (tx)=>{
            const uref = db.collection("users").doc(uid);
            tx.set(uref, { cards: firebase.firestore.FieldValue.arrayUnion(cid) }, { merge: true });
            tx.delete( uref.collection("shared").doc(cid) );
          });
        }
      }
      if (items.size === 0){ clearInterval(timer); timer = null; }
    }, 1000);
  });
}

/* ---------- Live log (sent + received) ---------- */
function renderLogLive(uid){
  const box = $("logList");
  box.innerHTML = `<div class="hint">กำลังโหลด…</div>`;
  const outQ = db.collection("shareInbox").where("fromUid","==",uid).orderBy("createdAt","desc").limit(30);
  const inQ  = db.collection("shareInbox").where("toUid","==",uid).orderBy("createdAt","desc").limit(30);

  let outDocs=[], inDocs=[];
  function paint(){
    function row(d, role){
      const v = d.data();
      const badge = (v.status==="converted") ? "converted" : (v.status==="borrowed" ? "borrowed" : "sent");
      const who = role==="out" ? `ถึง @${d._toName||v.toUid.slice(0,6)}` : `จาก @${d._fromName||v.fromUid.slice(0,6)}`;
      const when = v.createdAt?.toDate ? v.createdAt.toDate().toLocaleString() : "";
      return `<div class="log-item"><div><b>${v.cardId}</b> ${who}<br><small class="muted">${when}</small></div><div class="badge ${badge}">${v.status||"borrowed"}</div></div>`;
    }
    const merged = [...inDocs.map(d=>row(d,"in")), ...outDocs.map(d=>row(d,"out"))];
    box.innerHTML = merged.length ? merged.join("") : `<div class="hint">ยังไม่มีประวัติการแบ่งปัน</div>`;
  }

  outQ.onSnapshot(async (snap)=>{
    outDocs=[]; for (const d of snap.docs){ const name = await getUsernameByUid(d.data().toUid); const dd=d; dd._toName=name; outDocs.push(dd); } paint();
  });
  inQ.onSnapshot(async (snap)=>{
    inDocs=[]; for (const d of snap.docs){ const name = await getUsernameByUid(d.data().fromUid); const dd=d; dd._fromName=name; inDocs.push(dd); } paint();
  });
}

/* ---------- Start ---------- */
auth.onAuthStateChanged(async (user)=>{
  if (!user){ location.href = "login.html"; return; }
  currentUid = user.uid;

  // Ensure user doc exists (helps when "data lost")
  const uref = db.collection("users").doc(user.uid);
  const snap = await uref.get();
  if (!snap.exists){
    await uref.set({
      username: (user.email||"").split("@")[0] || "user",
      cards: [],
      mission: Array(15).fill(false),
      points: 0
    });
  }

  // NEW: make sure my /usernames/{name} mapping exists (or auto-suffix if taken)
  await ensureSelfUsernameMapping(user);

  // live owned cards
  uref.onSnapshot(s=>{
    const d = s.exists ? (s.data()||{}) : {};
    ownedCardsCache = Array.isArray(d.cards) ? d.cards : [];
    renderOwnedCards(ownedCardsCache);
  });

  watchBorrowed(user.uid);
  renderLogLive(user.uid);
});
