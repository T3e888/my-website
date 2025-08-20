// share.js — สร้าง /users/{toUid}/shared/{cardId} (ยืม 3 วัน)

const auth = firebase.auth();
const db   = firebase.firestore();

const $ = (id) => document.getElementById(id);
const DAY = 24 * 60 * 60 * 1000;
const BORROW_MS = 3 * DAY;

let currentUid = null;
let ownedCardsCache = [];

/* ---------- sidebar ---------- */
function setupSidebar(){
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
}

/* ---------- modal ---------- */
function showModal(msg, cb){
  const modal = $("modal");
  modal.innerHTML = `<div class="modal-content">${msg}<br><button class="ok">ตกลง</button></div>`;
  modal.classList.add("active");
  modal.querySelector(".ok").onclick = ()=>{ modal.classList.remove("active"); cb?.(); };
}

/* ---------- helpers ---------- */
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

/* ---------- render owned grid ---------- */
function renderOwnedCards(cards){
  const grid = $("ownedGrid");
  grid.innerHTML = "";
  if (!cards || !cards.length){
    grid.innerHTML = `<div class="hint">คุณยังไม่มีการ์ดเป็นเจ้าของ</div>`;
    return;
  }
  const sorted = cards.slice().sort((a,b)=> Number(a.replace('card','')) - Number(b.replace('card','')));
  for (const cid of sorted){
    const n = Number(cid.replace('card',''));
    const tile = document.createElement("div");
    tile.className = "cardTile";
    tile.style.backgroundImage = `url(assets/cards/${cid}.png)`;
    tile.title = `แบ่งปัน ${cid}`;
    tile.innerHTML = `<div class="cap">การ์ด ${n}</div>`;
    tile.onclick = ()=> onShareClick(currentUid, cid);
    grid.appendChild(tile);
  }
}

/* ---------- CREATE the borrow doc ---------- */
async function createBorrowDoc(toUid, fromUid, cardId){
  const untilTs = firebase.firestore.Timestamp.fromDate(new Date(Date.now() + BORROW_MS));
  const ref = db.collection("users").doc(toUid).collection("shared").doc(cardId);
  // Must match security rules: only these 4 fields
  await ref.set({
    cardId,
    fromUid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    until: untilTs
  });
}

/* ---------- Share flow ---------- */
async function onShareClick(fromUid, cardId){
  const username = ($("toUser").value || "").trim().toLowerCase();
  if (!username){ showModal("กรุณากรอกชื่อผู้รับ"); return; }

  try{
    const toUid = await getUidByUsername(username);
    if (!toUid){ showModal("ไม่พบบัญชีผู้รับ กรุณาให้ผู้รับบันทึกชื่อผู้ใช้ในหน้าโปรไฟล์"); return; }
    if (toUid === fromUid){ showModal("ไม่สามารถแบ่งปันการ์ดให้ตัวเองได้"); return; }

    // ต้องเป็นเจ้าของจึงจะแชร์ได้
    if (!ownedCardsCache.includes(cardId)){
      showModal("สามารถแบ่งปันได้เฉพาะการ์ดที่คุณเป็นเจ้าของเท่านั้น"); return;
    }

    // ผู้รับเป็นเจ้าของอยู่แล้ว?
    const toDoc = await db.collection("users").doc(toUid).get();
    const toCards = (toDoc.exists && Array.isArray(toDoc.data().cards)) ? toDoc.data().cards : [];
    if (toCards.includes(cardId)){ showModal("ผู้รับเป็นเจ้าของการ์ดนี้อยู่แล้ว"); return; }

    // ผู้รับกำลังยืมอยู่แล้ว?
    const sharedDoc = await db.collection("users").doc(toUid).collection("shared").doc(cardId).get();
    if (sharedDoc.exists){ showModal("ผู้รับกำลังยืมการ์ดนี้อยู่แล้ว"); return; }

    // สร้างรายการยืม
    try{
      await createBorrowDoc(toUid, fromUid, cardId);
    }catch(e){
      const code = e?.code || "";
      const msg  = e?.message || e;
      console.error("borrowed-doc create failed:", e);
      showModal(`❌ แบ่งปันไม่สำเร็จ (สร้างรายการยืม):<br><small>${code} – ${msg}</small>`);
      return;
    }

    // บันทึกล็อก (พยายามบันทึก แม้กฎจะบล็อกก็ไม่เป็นไร)
    try{
      await db.collection("shareInbox").add({
        fromUid,
        toUid,
        cardId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: "borrowed"
      });
    }catch(e){ console.warn("shareInbox add blocked:", e?.code || e); }

    showModal(`✅ แบ่งปัน <b>${cardId}</b> ให้ <b>@${username}</b> เรียบร้อยแล้ว`);
  }catch(e){
    console.error("Share flow error:", e);
    showModal(`❌ แบ่งปันไม่สำเร็จ:<br><small>${e?.code || ""} ${e?.message || e}</small>`);
  }
}

/* ---------- countdown + log ---------- */
function watchBorrowed(uid){
  const list = $("borrowedList");
  list.innerHTML = `<div class="hint">กำลังโหลด…</div>`;

  let timer = null;
  const items = new Map();

  db.collection("users").doc(uid).collection("shared").onSnapshot(async (snap)=>{
    items.clear();
    list.innerHTML = "";

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
        <div class="thumb" style="background-image:url(assets/cards/${cardId}.png)"></div>
        <div class="meta">
          <div><b>${cardId}</b> — ยืมมาจาก <b>@${fromName}</b></div>
          <div class="timer" data-card="${cardId}">—</div>
        </div>`;
      list.appendChild(el);
      items.set(cardId, { el, until, fromUid: v.fromUid });
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
          // convert: เพิ่มการ์ดให้ผู้ยืม + ลบสถานะยืม
          await db.runTransaction(async (tx)=>{
            const uref = db.collection("users").doc(uid);
            tx.set(uref, { cards: firebase.firestore.FieldValue.arrayUnion(cid) }, { merge: true });
            tx.delete( uref.collection("shared").doc(cid) );
          });
        }
      }
      if (items.size === 0){ clearInterval(timer); timer = null; }
    }, 1000);
  }, (err)=>{
    console.error("shared listener error:", err);
    list.innerHTML = `<div class="hint">ไม่สามารถโหลดการ์ดที่ยืมได้ (สิทธิ์การเข้าถึง)</div>`;
  });
}

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
      return `<div class="log-item"><div><b>${v.cardId}</b> ${who}<br><small>${when}</small></div><div class="badge ${badge}">${v.status||"borrowed"}</div></div>`;
    }
    box.innerHTML = [...inDocs.map(d=>row(d,"in")), ...outDocs.map(d=>row(d,"out"))].slice(0,30).join("") || `<div class="hint">ยังไม่มีประวัติการแบ่งปัน</div>`;
  }

  outQ.onSnapshot(async (snap)=>{
    outDocs=[]; for (const d of snap.docs){ const name = await getUsernameByUid(d.data().toUid); const dd=d; dd._toName=name; outDocs.push(dd); } paint();
  });
  inQ.onSnapshot(async (snap)=>{
    inDocs=[]; for (const d of snap.docs){ const name = await getUsernameByUid(d.data().fromUid); const dd=d; dd._fromName=name; inDocs.push(dd); } paint();
  });
}

/* ---------- start ---------- */
auth.onAuthStateChanged(async (user)=>{
  if (!user){ location.href = "login.html"; return; }
  currentUid = user.uid;
  setupSidebar();

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

  // live owned cards
  uref.onSnapshot(s=>{
    const d = s.exists ? (s.data()||{}) : {};
    ownedCardsCache = Array.isArray(d.cards) ? d.cards : [];
    renderOwnedCards(ownedCardsCache);
  });

  watchBorrowed(user.uid);
  renderLogLive(user.uid);
});
