// share.js — full share system with username validation, logs, countdown, auto-convert
const auth = firebase.auth();
const db   = firebase.firestore();

const $ = (id) => document.getElementById(id);
const DAY = 24*60*60*1000;
const BORROW_MS = 3*DAY;

let currentUid = null;
let ownedCardsCache = [];
let didHealFromKeys = false;

/* ===== Sidebar (same as other pages) ===== */
function setupSidebar(){
  const toggleBtn = $("menu-toggle");
  const sidebar = $("sidebar");
  const overlay = $("overlay");
  const closeBtn = $("close-sidebar");
  const logout = $("logout-link");

  const open  = ()=>{ sidebar.classList.add("open"); overlay.classList.add("active"); };
  const close = ()=>{ sidebar.classList.remove("open"); overlay.classList.remove("active"); };

  toggleBtn?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  overlay?.addEventListener("click", close);
  logout?.addEventListener("click", (e)=>{ e.preventDefault(); auth.signOut().then(()=>location.href="login.html"); });
}

/* ===== Modal ===== */
function showModal(msg, cb){
  const modal = $("modal");
  modal.innerHTML = `<div class="modal-content">${msg}<br><button class="ok">OK</button></div>`;
  modal.classList.add("active");
  modal.querySelector(".ok").onclick = ()=>{ modal.classList.remove("active"); if(cb) cb(); };
}

/* ===== Username helpers ===== */
async function getUidByUsername(unameRaw){
  const uname = (unameRaw||"").trim().toLowerCase();
  if (!uname) return null;

  // 1) primary directory
  const dir = await db.collection("usernames").doc(uname).get();
  if (dir.exists && dir.data()?.uid) return dir.data().uid;

  // 2) fallback: search users by username field
  const snap = await db.collection("users").where("username","==",uname).limit(1).get();
  if (!snap.empty) return snap.docs[0].id;

  return null;
}
async function getUsernameByUid(uid){
  try {
    const snap = await db.collection("users").doc(uid).get();
    return (snap.exists && snap.data().username) ? snap.data().username : uid.slice(0,6);
  } catch { return uid.slice(0,6); }
}

/* ===== Self-heal: sync claimed keys → users/{uid}.cards if empty ===== */
async function healOwnedCards(uid){
  const q = await db.collection('cardKeys').where('claimedBy','==',uid).limit(200).get();
  if (q.empty) return false;
  const ids = [];
  q.forEach(d => { const v = d.data(); if (v && typeof v.cardId === 'string') ids.push(v.cardId); });
  if (!ids.length) return false;

  const ref = db.collection('users').doc(uid);
  const BATCH = 10;
  for (let i=0;i<ids.length;i+=BATCH){
    await ref.set({ cards: firebase.firestore.FieldValue.arrayUnion(...ids.slice(i,i+BATCH)) }, { merge:true });
  }
  return true;
}

/* ===== Owned grid ===== */
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
    div.style.backgroundImage = `url(assets/cards/${cid}.png)`;
    div.title = `Share ${cid}`;
    div.innerHTML = `<div class="cap">Card ${n}</div>`;
    div.onclick = ()=> onShareClick(currentUid, cid);
    grid.appendChild(div);
  }
}

/* ===== Share flow ===== */
async function onShareClick(fromUid, cardId){
  const username = ($("toUser").value || "").trim().toLowerCase();
  if (!username) { showModal("Please enter a recipient username."); return; }

  const toUid = await getUidByUsername(username);
  if (!toUid) { showModal("Username not found."); return; }
  if (toUid === fromUid) { showModal("You can’t share a card to yourself."); return; }

  // Only share truly owned cards
  if (!ownedCardsCache.includes(cardId)) { showModal("Only owned cards can be shared."); return; }

  // Recipient already owns?
  const toDoc = await db.collection("users").doc(toUid).get();
  const toCards = (toDoc.exists && Array.isArray(toDoc.data().cards)) ? toDoc.data().cards : [];
  if (toCards.includes(cardId)) { showModal("Recipient already owns this card."); return; }

  // Already borrowing?
  const sharedRef = db.collection("users").doc(toUid).collection("shared").doc(cardId);
  const sharedSnap = await sharedRef.get();
  if (sharedSnap.exists){
    const d = sharedSnap.data();
    const until = d?.until?.toDate ? d.until.toDate().getTime() : null;
    if (until){
      const ms = until - Date.now();
      const days = Math.max(0, Math.ceil(ms / DAY));
      showModal(`They are already borrowing this card.<br>Time left: ~${days} day(s).`);
    } else {
      showModal("They are already borrowing this card.");
    }
    return;
  }

  // Create borrowed doc for 3 days
  const untilTs = new Date(Date.now() + BORROW_MS);
  await sharedRef.set({
    cardId,
    fromUid: fromUid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    until: untilTs
  });

  // Add log (no index required approach: simple add)
  await db.collection("shareInbox").add({
    fromUid: fromUid,
    toUid: toUid,
    cardId: cardId,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    status: "borrowed"
  });

  showModal(`✅ Shared <b>${cardId}</b> to <b>@${username}</b> for <b>3 days</b>.`);
}

/* ===== Borrowed list + countdown + auto-convert ===== */
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

async function convertToOwner(uid, cardId, fromUid){
  // Add to cards[] and delete shared/{cardId}
  await db.runTransaction(async (tx)=>{
    const uref = db.collection("users").doc(uid);
    const usnap = await tx.get(uref);
    if (!usnap.exists) return;
    tx.set(uref, { cards: firebase.firestore.FieldValue.arrayUnion(cardId) }, { merge: true });
    tx.delete( uref.collection("shared").doc(cardId) );
  });

  // Update the latest matching shareInbox item (pick newest client-side)
  const q = await db.collection("shareInbox")
    .where("toUid","==", uid)
    .where("cardId","==", cardId)
    .get();
  if (!q.empty){
    let latest = q.docs[0];
    q.docs.forEach(d=>{
      const a = latest.data().createdAt?.toMillis?.() || 0;
      const b = d.data().createdAt?.toMillis?.() || 0;
      if (b > a) latest = d;
    });
    await latest.ref.update({
      status: "converted",
      acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  const fromName = await getUsernameByUid(fromUid);
  showModal(`🎉 Your borrowed <b>${cardId}</b> from <b>@${fromName}</b> is now <b>permanent</b>.`);
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
        return;
      }

      for (const d of snap.docs){
        const data = d.data();
        const cardId = data.cardId;
        const until = data.until?.toDate ? data.until.toDate().getTime() : (Date.now()+BORROW_MS);
        const fromUid = data.fromUid;
        const fromName = await getUsernameByUid(fromUid);

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
        const t = Date.now();
        for (const [cardId, obj] of items){
          const remain = obj.until - t;
          const timerEl = obj.el.querySelector(`.timer[data-card="${cardId}"]`);
          if (!timerEl) continue;
          if (remain > 0){
            timerEl.textContent = `Time left: ${fmt(remain)}`;
          } else {
            timerEl.textContent = "Converting…";
            items.delete(cardId);
            await convertToOwner(uid, cardId, obj.fromUid);
          }
        }
        if (items.size === 0 && countdownTimer){ clearInterval(countdownTimer); countdownTimer = null; }
      }, 1000);
    });
}

/* ===== Activity log (no index required — client sorts) ===== */
async function renderLog(uid){
  const box = $("logList");
  box.innerHTML = `<div class="hint">Loading…</div>`;

  const sentQ = await db.collection("shareInbox").where("fromUid","==",uid).get();
  const gotQ  = await db.collection("shareInbox").where("toUid","==",uid).get();

  const rows = [];
  sentQ.forEach(d => rows.push({doc:d, role:"out"}));
  gotQ.forEach(d  => rows.push({doc:d, role:"in"}));

  rows.sort((a,b)=>{
    const at = a.doc.data().createdAt?.toMillis?.() || 0;
    const bt = b.doc.data().createdAt?.toMillis?.() || 0;
    return bt - at;
  });

  async function rowHTML(d, role){
    const data = d.data();
    const status = data.status || "borrowed";
    const badge = status === "converted" ? "converted" : (status === "borrowed" ? "borrowed" : "sent");
    const name = role === "out" ? `to @${await getUsernameByUid(data.toUid)}` : `from @${await getUsernameByUid(data.fromUid)}`;
    const when = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString() : "";
    return `<div class="log-item">
      <div><b>${data.cardId}</b> ${name}<br><small>${when}</small></div>
      <div class="badge ${badge}">${status}</div>
    </div>`;
  }

  const htmlParts = [];
  for (const r of rows.slice(0,20)){
    htmlParts.push(await rowHTML(r.doc, r.role));
  }
  box.innerHTML = htmlParts.join("") || `<div class="hint">No share activity yet.</div>`;
}

/* ===== Start ===== */
auth.onAuthStateChanged(async (user)=>{
  if (!user){ location.href = "login.html"; return; }
  currentUid = user.uid;
  setupSidebar();

  // Ensure user doc exists (do NOT wipe cards)
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

  // Live owned cards; if empty once, self-heal from cardKeys
  uref.onSnapshot(async (snap)=>{
    const data  = snap.exists ? (snap.data() || {}) : {};
    const cards = Array.isArray(data.cards) ? data.cards : [];
    ownedCardsCache = cards;
    renderOwnedCards(cards);
    if (!didHealFromKeys && cards.length === 0){
      didHealFromKeys = true;
      const healed = await healOwnedCards(user.uid);
      if (healed){
        // onSnapshot will re-render with repaired data
      }
    }
  });

  watchBorrowed(user.uid);
  renderLog(user.uid);
});
