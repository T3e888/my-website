// share.js — create /users/{toUid}/shared/{cardId} on click (3-day lend)

const auth = firebase.auth();
const db   = firebase.firestore();

const $ = (id) => document.getElementById(id);
const DAY = 24*60*60*1000;
const BORROW_MS = 3*DAY;

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
  modal.innerHTML = `<div class="modal-content">${msg}<br><button class="ok">OK</button></div>`;
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
    grid.innerHTML = `<div class="hint">You don’t own any cards yet.</div>`;
    return;
  }
  const sorted = cards.slice().sort((a,b)=> Number(a.replace('card','')) - Number(b.replace('card','')));
  for (const cid of sorted){
    const n = Number(cid.replace('card',''));
    const tile = document.createElement("div");
    tile.className = "cardTile";
    tile.style.backgroundImage = `url(assets/cards/${cid}.png)`;
    tile.title = `Share ${cid}`;
    tile.innerHTML = `<div class="cap">Card ${n}</div>`;
    tile.onclick = ()=> onShareClick(currentUid, cid);
    grid.appendChild(tile);
  }
}

/* ---------- CREATE the borrow doc ---------- */
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

/* ---------- Share flow ---------- */
async function onShareClick(fromUid, cardId){
  const username = ($("toUser").value || "").trim().toLowerCase();
  if (!username){ showModal("Please enter a recipient username."); return; }

  try{
    const toUid = await getUidByUsername(username);
    if (!toUid){ showModal("Username not found. Ask them to save it on Profile."); return; }
    if (toUid === fromUid){ showModal("You can’t share a card to yourself."); return; }

    // Only owners can share
    if (!ownedCardsCache.includes(cardId)){
      showModal("Only cards you own can be shared."); return;
    }

    // Recipient already owns this card?
    const toDoc = await db.collection("users").doc(toUid).get();
    const toCards = (toDoc.exists && Array.isArray(toDoc.data().cards)) ? toDoc.data().cards : [];
    if (toCards.includes(cardId)){ showModal("Recipient already owns this card."); return; }

    // Already borrowing?
    const sharedDoc = await db.collection("users").doc(toUid).collection("shared").doc(cardId).get();
    if (sharedDoc.exists){ showModal("They are already borrowing this card."); return; }

    // *** CREATE the subcollection doc (this is what makes /users/{toUid}/shared/{cardId}) ***
    try{
      await createBorrowDoc(toUid, fromUid, cardId);
    }catch(e){
      // Surface exact rule error to the user so you know what to fix
      const code = e?.code || "";
      const msg  = e?.message || e;
      console.error("borrowed-doc create failed:", e);
      showModal(`❌ Share failed (borrow entry):<br><small>${code} – ${msg}</small>`);
      return;
    }

    // Best-effort activity log (ignore if rules block)
    try{
      await db.collection("shareInbox").add({
        fromUid,
        toUid,
        cardId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: "borrowed"
      });
    }catch(e){ console.warn("shareInbox add blocked:", e?.code || e); }

    showModal(`✅ Shared <b>${cardId}</b> with <b>@${username}</b>.`);
  }catch(e){
    console.error("Share flow error:", e);
    showModal(`❌ Share failed:<br><small>${e?.code || ""} ${e?.message || e}</small>`);
  }
}

/* ---------- countdown + log (unchanged) ---------- */
function watchBorrowed(uid){
  const list = $("borrowedList");
  list.innerHTML = `<div class="hint">Loading…</div>`;

  let timer = null;
  const items = new Map();

  db.collection("users").doc(uid).collection("shared").onSnapshot(async (snap)=>{
    items.clear();
    list.innerHTML = "";

    if (snap.empty){
      list.innerHTML = `<div class="hint">You have no borrowed cards right now.</div>`;
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
          <div><b>${cardId}</b> — borrowed from <b>@${fromName}</b></div>
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
          const h = String(Math.floor(s/3600)).padStart(2,'0');
          const m = String(Math.floor((s%3600)/60)).padStart(2,'0');
          const ss= String(s%60).padStart(2,'0');
          tEl.textContent = `Time left: ${h}:${m}:${ss}`;
        }else{
          tEl.textContent = "Converting…";
          items.delete(cid);
          // convert: add to cards[] + delete shared
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
    list.innerHTML = `<div class="hint">Couldn’t load borrowed cards.</div>`;
  });
}

function renderLogLive(uid){
  const box = $("logList");
  box.innerHTML = `<div class="hint">Loading…</div>`;
  const outQ = db.collection("shareInbox").where("fromUid","==",uid).orderBy("createdAt","desc").limit(30);
  const inQ  = db.collection("shareInbox").where("toUid","==",uid).orderBy("createdAt","desc").limit(30);

  let outDocs=[], inDocs=[];
  function paint(){
    function row(d, role){
      const v = d.data();
      const badge = (v.status==="converted") ? "converted" : (v.status==="borrowed" ? "borrowed" : "sent");
      const who = role==="out" ? `to @${d._toName||v.toUid.slice(0,6)}` : `from @${d._fromName||v.fromUid.slice(0,6)}`;
      const when = v.createdAt?.toDate ? v.createdAt.toDate().toLocaleString() : "";
      return `<div class="log-item"><div><b>${v.cardId}</b> ${who}<br><small>${when}</small></div><div class="badge ${badge}">${v.status||"borrowed"}</div></div>`;
    }
    box.innerHTML = [...inDocs.map(d=>row(d,"in")), ...outDocs.map(d=>row(d,"out"))].slice(0,30).join("") || `<div class="hint">No share activity yet.</div>`;
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
