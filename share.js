// share.js — Share cards for 3 days, then auto-convert to owner
const auth = firebase.auth();
const db   = firebase.firestore();

const $ = (id) => document.getElementById(id);
const DAY = 24*60*60*1000;
const BORROW_MS = 3*DAY;

let currentUid = null;
let ownedCardsCache = [];
let didHealFromKeys = false;

/* ===== Sidebar (same pattern as your other pages) ===== */
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

/* ===== One-time self-heal: sync claimed keys -> users/{uid}.cards ===== */
async function healOwnedCards(uid){
  const q = await db.collection('cardKeys').where('claimedBy','==',uid).limit(200).get();
  if (q.empty) return false;
  const ids = [];
  q.forEach(d => { const v = d.data(); if (v && typeof v.cardId === 'string') ids.push(v.cardId); });
  if (!ids.length) return false;

  const ref = db.collection('users').doc(uid);
  const BATCH = 10;
  for (let i=0;i<ids.length;i+=BATCH){
    const slice = ids.slice(i, i+BATCH);
    await ref.set({ cards: firebase.firestore.FieldValue.arrayUnion(...slice) }, { merge:true });
  }
  return true;
}

/* ===== Owned cards grid ===== */
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

/* ===== Share flow (UPDATED) ===== */
async function onShareClick(fromUid, cardId){
  const username = ($("toUser").value || "").trim().toLowerCase();
  if (!username) { showModal("Please enter a recipient username."); return; }

  try {
    const toUid = await getUidByUsername(username);
    if (!toUid) { showModal("Username not found."); return; }
    if (toUid === fromUid) { showModal("You can’t share a card to yourself."); return; }

    // Only allow sharing of truly-owned cards (not borrowed)
    if (!ownedCardsCache.includes(cardId)) { showModal("Only owned cards can be shared."); return; }

    // Recipient already owns?
    const toDoc = await db.collection("users").doc(toUid).get();
    const toCards = (toDoc.exists && Array.isArray(toDoc.data().cards)) ? toDoc.data().cards : [];
    if (toCards.includes(cardId)) { showModal("Recipient already owns this card."); return; }

    // Already borrowing?
    const sharedRef = db.collection("users").doc(toUid).collection("shared").doc(cardId);
    const sharedSnap = await sharedRef.get();
    if (sharedSnap.exists){
      showModal("They are already borrowing this card.");
      return;
    }

    // --- STEP 1: create borrowed doc under recipient (use Timestamp for 'until') ---
    const untilTs = firebase.firestore.Timestamp.fromDate(new Date(Date.now() + BORROW_MS));
    try {
      await sharedRef.set({
        cardId,
        fromUid: fromUid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        until: untilTs
      });
    } catch (e) {
      showModal(`❌ Share failed (creating borrowed doc):<br><small>${e?.message || e}</small>`);
      return;
    }

    // --- STEP 2: log the share (best-effort; don't block success if this fails) ---
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

    showModal(`✅ Shared <b>${cardId}</b> to <b>@${username}</b> for <b>3 days</b>.`);
  } catch (e){
    console.error("Share failed:", e);
    showModal(`❌ Share failed:<br><small>${e?.message || e}</small>`);
  }
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
  await db.runTransaction(async (tx)=>{
    const uref = db.collection("users").doc(uid);
    const usnap = await tx.get(uref);
    if (!usnap.exists) return;
    tx.set(uref, { cards: firebase.firestore.FieldValue.arrayUnion(cardId) }, { merge: true });
    tx.delete( uref.collection("shared").doc(cardId) );
  });

  const q = await db.collection("shareInbox")
    .where("toUid","==", uid)
    .where("cardId","==", cardId)
    .orderBy("createdAt","desc")
    .limit(1).get();
  if (!q.empty){
    await q.docs[0].ref.update({
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

/* ===== Activity log ===== */
async function renderLog(uid){
  const box = $("logList");
  box.innerHTML = `<div class="hint">Loading…</div>`;

  const sent = await db.collection("shareInbox").where("fromUid","==",uid).orderBy("createdAt","desc").limit(20).get();
  const got  = await db.collection("shareInbox").where("toUid","==",uid).orderBy("createdAt","desc").limit(20).get();

  function row(d, role){
    const data = d.data();
    const status = data.status || "borrowed";
    const badgeClass = status === "converted" ? "converted" : (status === "borrowed" ? "borrowed" : "sent");
    const who = role === "out" ? `to @${d._toName || data.toUid.slice(0,6)}` : `from @${d._fromName || data.fromUid.slice(0,6)}`;
    const when = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString() : "";
    return `<div class="log-item">
      <div><b>${data.cardId}</b> ${who}<br><small>${when}</small></div>
      <div class="badge ${badgeClass}">${status}</div>
    </div>`;
  }

  const sentDocs = [];
  for (const d of sent.docs){
    const toName = await getUsernameByUid(d.data().toUid);
    const dd = d; dd._toName = toName; sentDocs.push(dd);
  }
  const gotDocs = [];
  for (const d of got.docs){
    const fromName = await getUsernameByUid(d.data().fromUid);
    const dd = d; dd._fromName = fromName; gotDocs.push(dd);
  }

  const html = [
    ...gotDocs.map(d=>row(d, "in")),
    ...sentDocs.map(d=>row(d, "out"))
  ].slice(0,20).join("");

  box.innerHTML = html || `<div class="hint">No share activity yet.</div>`;
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
        // onSnapshot will re-render with fixed data
      }
    }
  });

  watchBorrowed(user.uid);
  renderLog(user.uid);
});
