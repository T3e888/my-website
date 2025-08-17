// share.js — robust share, 3-day borrow, logs, "lent-out" UI

const auth = firebase.auth();
const db   = firebase.firestore();

const $ = (id) => document.getElementById(id);
const DAY = 24*60*60*1000;
const BORROW_MS = 3*DAY;

let currentUid = null;
let ownedCardsCache = [];
let didHealFromKeys = false;
let lentOutSet = new Set();   // cards I'm currently lending out

const DBG = true;
const dlog = (...a)=>{ if (DBG) console.log("[share]", ...a); };

/* ===== Sidebar ===== */
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
}

/* ===== Modal ===== */
function showModal(msg, cb){
  const m = $("modal");
  if (!m) return;
  m.innerHTML = `<div class="modal-content">${msg}<br><button class="ok">OK</button></div>`;
  m.classList.add("active");
  m.querySelector(".ok").onclick = ()=>{ m.classList.remove("active"); cb?.(); };
}

/* ===== Username helpers ===== */
async function getUidByUsername(username){
  const uname = (username||"").trim().toLowerCase();
  if (!uname) return null;
  const doc = await db.collection("usernames").doc(uname).get();
  return doc.exists ? (doc.data().uid || null) : null;
}
async function getUsernameByUid(uid){
  try {
    const snap = await db.collection("users").doc(uid).get();
    return (snap.exists && snap.data().username) ? snap.data().username : uid.slice(0,6);
  } catch { return uid.slice(0,6); }
}

/* ===== Self-heal: cardKeys → users/{uid}.cards ===== */
async function healOwnedCards(uid){
  const q = await db.collection('cardKeys').where('claimedBy','==',uid).limit(200).get();
  if (q.empty) return false;
  const ids = [];
  q.forEach(d => { const v = d.data(); if (v && typeof v.cardId === 'string') ids.push(v.cardId); });
  if (!ids.length) return false;
  const ref = db.collection('users').doc(uid);
  for (let i=0;i<ids.length;i+=10){
    const slice = ids.slice(i, i+10);
    await ref.set({ cards: firebase.firestore.FieldValue.arrayUnion(...slice) }, { merge:true });
  }
  return true;
}

/* ===== Owned grid (with "lent-out" tint) ===== */
function renderOwnedCards(cards){
  const grid = $("ownedGrid");
  grid.innerHTML = "";
  if (!cards || !cards.length){
    grid.innerHTML = `<div class="hint">You don’t own any cards yet.</div>`;
    return;
  }
  const sorted = cards.slice().sort((a,b)=> Number(a.replace('card','')) - Number(b.replace('card','')));

  for (const cid of sorted){
    const n = Number(cid.replace('card',''));
    const div = document.createElement("div");
    div.className = "cardTile";
    if (lentOutSet.has(cid)) div.classList.add("lent");
    div.style.backgroundImage = `url(assets/cards/${cid}.png)`;
    div.title = lentOutSet.has(cid) ? `Lent out: ${cid}` : `Share ${cid}`;
    div.innerHTML = `<div class="cap">${lentOutSet.has(cid) ? "Lent" : "Card"} ${n}</div>`;
    div.onclick = ()=>{
      if (lentOutSet.has(cid)) {
        showModal(`You’re already lending <b>${cid}</b>. It will return automatically after 3 days.`);
      } else {
        onShareClick(currentUid, cid);
      }
    };
    grid.appendChild(div);
  }
}

/* ===== Track "lent-out" using shareInbox ===== */
function watchLentOut(uid){
  db.collection("shareInbox")
    .where("fromUid","==",uid)
    .orderBy("createdAt","desc")
    .limit(100)
    .onSnapshot((snap)=>{
      lentOutSet.clear();
      snap.forEach(d=>{
        const v = d.data();
        if (!v) return;
        // Consider active if not converted (older docs may not have status)
        if (v.status !== 'converted' && typeof v.cardId === 'string') {
          lentOutSet.add(v.cardId);
        }
      });
      renderOwnedCards(ownedCardsCache);
    });
}

/* ===== Share flow ===== */
async function onShareClick(fromUid, cardId){
  const username = ($("toUser").value || "").trim().toLowerCase();
  if (!username) { showModal("Please enter a recipient username."); return; }

  try {
    const toUid = await getUidByUsername(username);
    if (!toUid) { showModal("Username not found."); return; }
    if (toUid === fromUid) { showModal("You can’t share a card to yourself."); return; }

    if (!ownedCardsCache.includes(cardId)) { showModal("Only owned cards can be shared."); return; }

    // Recipient already owns?
    const toDoc = await db.collection("users").doc(toUid).get();
    const toCards = (toDoc.exists && Array.isArray(toDoc.data().cards)) ? toDoc.data().cards : [];
    if (toCards.includes(cardId)) { showModal("Recipient already owns this card."); return; }

    const sharedRef = db.collection("users").doc(toUid).collection("shared").doc(cardId);
    const sharedSnap = await sharedRef.get();
    if (sharedSnap.exists){ showModal("They are already borrowing this card."); return; }

    // Create borrowed doc (3 days)
    const untilTs = firebase.firestore.Timestamp.fromDate(new Date(Date.now() + BORROW_MS));
    try {
      await sharedRef.set({
        cardId: cardId,
        fromUid: fromUid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        until: untilTs
      }, { merge:false });
    } catch (e) {
      console.error("sharedRef.set failed:", e);
      showModal(`❌ Share failed (creating borrowed doc):<br><small>${e?.message || e}</small>`);
      return;
    }

    // Best-effort log
    try {
      await db.collection("shareInbox").add({
        fromUid: fromUid,
        toUid: toUid,
        cardId: cardId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: "borrowed"
      });
    } catch (e) {
      console.warn("shareInbox add failed:", e);
    }

    showModal(`✅ You successfully shared <b>${cardId}</b> with <b>@${username}</b>.`);
  } catch (e){
    console.error("Share failed:", e);
    showModal(`❌ Share failed:<br><small>${e?.message || e}</small>`);
  }
}

/* ===== Borrowed list + countdown (recipient) ===== */
function fmt(ms){
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms/1000);
  const h = Math.floor(s/3600);
  const m = Math.floor((s%3600)/60);
  const ss = s%60;
  const pad = (n)=> String(n).padStart(2,'0');
  return `${pad(h)}:${pad(m)}:${pad(ss)}`;
}
let countdownTimer = null;
function seenKey(key){ const k=`seen_${currentUid}_${key}`; return localStorage.getItem(k) === '1'; }
function markSeen(key){ const k=`seen_${currentUid}_${key}`; localStorage.setItem(k,'1'); }

async function convertToOwner(uid, cardId, fromUid){
  await db.runTransaction(async (tx)=>{
    const uref = db.collection("users").doc(uid);
    const usnap = await tx.get(uref);
    if (!usnap.exists) return;
    tx.set(uref, { cards: firebase.firestore.FieldValue.arrayUnion(cardId) }, { merge: true });
    tx.delete( uref.collection("shared").doc(cardId) );
  });

  try {
    const q = await db.collection("shareInbox")
      .where("toUid","==", uid).where("cardId","==", cardId)
      .orderBy("createdAt","desc").limit(1).get();
    if (!q.empty){ await q.docs[0].ref.update({ status:"converted", acceptedAt: firebase.firestore.FieldValue.serverTimestamp() }); }
  } catch (e) { console.warn("shareInbox update failed:", e); }

  const fromName = await getUsernameByUid(fromUid);
  showModal(`🎉 Your borrowed <b>${cardId}</b> from <b>@${fromName}</b> is now <b>permanently yours</b>.`);
}

function watchBorrowed(uid){
  const list = $("borrowedList");
  list.innerHTML = `<div class="hint">Loading…</div>`;
  if (countdownTimer){ clearInterval(countdownTimer); countdownTimer = null; }

  const items = new Map();

  db.collection("users").doc(uid).collection("shared")
    .onSnapshot(async (snap)=>{
      items.clear();
      list.innerHTML = "";
      if (snap.empty){
        list.innerHTML = `<div class="hint">You have no borrowed cards right now.</div>`;
        if (countdownTimer){ clearInterval(countdownTimer); countdownTimer = null; }
        return;
      }

      for (const d of snap.docs){
        const data = d.data();
        const cardId = data.cardId;
        const until  = data.until?.toDate ? data.until.toDate().getTime() : (Date.now()+BORROW_MS);
        const fromUid = data.fromUid;
        const fromName = await getUsernameByUid(fromUid);

        const key = `received_${cardId}_${d.id}`;
        if (!seenKey(key)){
          showModal(`📩 You received <b>${cardId}</b> from <b>@${fromName}</b>.<br>It will become permanently yours in <b>72 hours</b>.`);
          markSeen(key);
        }

        const el = document.createElement("div");
        el.className = "borrowed";
        el.innerHTML = `
          <div class="thumb" style="background-image:url(assets/cards/${cardId}.png)"></div>
          <div class="meta">
            <div><b>${cardId}</b> — borrowed from <b>@${fromName}</b></div>
            <div class="timer" data-card="${cardId}">—</div>
          </div>`;
        list.appendChild(el);
        items.set(cardId, { el, until, fromUid });
      }

      if (countdownTimer){ clearInterval(countdownTimer); }
      countdownTimer = setInterval(async ()=>{
        const now = Date.now();
        for (const [cardId, obj] of items){
          const remain = obj.until - now;
          const el = obj.el.querySelector(`.timer[data-card="${cardId}"]`);
          if (!el) continue;
          if (remain > 0) el.textContent = `Time left: ${fmt(remain)}`;
          else {
            el.textContent = "Converting…";
            items.delete(cardId);
            await convertToOwner(uid, cardId, obj.fromUid);
          }
        }
        if (items.size === 0 && countdownTimer){ clearInterval(countdownTimer); countdownTimer = null; }
      }, 1000);
    }, (err)=>{
      console.error("shared listener error:", err);
      list.innerHTML = `<div class="hint">Couldn’t load borrowed cards.</div>`;
    });
}

/* ===== Live activity log ===== */
function renderLogLive(uid){
  const box = $("logList");
  box.innerHTML = `<div class="hint">Loading…</div>`;

  const outQ = db.collection("shareInbox").where("fromUid","==",uid).orderBy("createdAt","desc").limit(30);
  const inQ  = db.collection("shareInbox").where("toUid","==",uid).orderBy("createdAt","desc").limit(30);

  let outDocs=[], inDocs=[];
  function paint(){
    function row(d, role){
      const data = d.data();
      const status = data.status || "borrowed";
      const badgeClass = status === "converted" ? "converted" : (status === "borrowed" ? "borrowed" : "sent");
      const who = role === "out" ? `to @${d._toName || data.toUid.slice(0,6)}`
                                 : `from @${d._fromName || data.fromUid.slice(0,6)}`;
      const when = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString() : "";
      return `<div class="log-item">
        <div><b>${data.cardId}</b> ${who}<br><small>${when}</small></div>
        <div class="badge ${badgeClass}">${status}</div>
      </div>`;
    }
    const html = [...inDocs.map(d=>row(d,"in")), ...outDocs.map(d=>row(d,"out"))].slice(0,30).join("");
    box.innerHTML = html || `<div class="hint">No share activity yet.</div>`;
  }

  outQ.onSnapshot(async (snap)=>{
    outDocs=[]; for (const d of snap.docs){ const toName = await getUsernameByUid(d.data().toUid); const dd=d; dd._toName=toName; outDocs.push(dd); }
    paint();
  });
  inQ.onSnapshot(async (snap)=>{
    inDocs=[]; for (const d of snap.docs){ const fromName = await getUsernameByUid(d.data().fromUid); const dd=d; dd._fromName=fromName; inDocs.push(dd); }
    paint();
  });
}

/* ===== Start ===== */
auth.onAuthStateChanged(async (user)=>{
  if (!user){ location.href = "login.html"; return; }
  currentUid = user.uid;
  setupSidebar();

  const uref = db.collection("users").doc(user.uid);
  const first = await uref.get();
  if (!first.exists){
    await uref.set({
      username: (user.email||"").split("@")[0] || "user",
      cards: [],
      mission: Array(15).fill(false),
      points: 0
    });
  }

  // Live owned cards + one-time heal
  uref.onSnapshot(async (snap)=>{
    const data  = snap.exists ? (snap.data() || {}) : {};
    const cards = Array.isArray(data.cards) ? data.cards : [];
    ownedCardsCache = cards;
    renderOwnedCards(cards);
    if (!didHealFromKeys && cards.length === 0){
      didHealFromKeys = true;
      const healed = await healOwnedCards(user.uid);
      if (healed){ /* will re-render */ }
    }
  });

  watchLentOut(user.uid);   // tint “lent” cards for the sender
  watchBorrowed(user.uid);  // recipient countdown + auto-convert
  renderLogLive(user.uid);  // activity log
});
