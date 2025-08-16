// ========== card.js (robust render + auto-convert borrowed → owned) ==========

const byId = (id) => document.getElementById(id);
const TOTAL_CARDS = 25;

// --- Sidebar (same as before) ---
function setupSidebar() {
  const toggleBtn = byId("menu-toggle");
  const sidebar   = byId("sidebar");
  const overlay   = byId("overlay");
  const closeBtn  = byId("close-sidebar");
  const logout    = byId("logout-link");

  const open  = () => { sidebar.classList.add("open");  overlay.classList.add("active"); };
  const close = () => { sidebar.classList.remove("open"); overlay.classList.remove("active"); };

  toggleBtn?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  overlay?.addEventListener("click", close);
  logout?.addEventListener("click", (e)=>{ e.preventDefault(); auth.signOut().then(()=>location.href="login.html"); });

  // close when navigating
  document.querySelectorAll("#sidebar .menu-item a").forEach(a=>{
    if (!a.closest("#logout-link")) a.addEventListener("click", close);
  });
}

// --- Modal helper ---
function showModal(html) {
  const modal = byId("modal");
  if (!modal) return;
  modal.innerHTML = `<div class="modal-content">${html}<br><button class="modal-close">OK</button></div>`;
  modal.classList.add("active");
  modal.querySelector(".modal-close").onclick = () => modal.classList.remove("active");
}

// --- Grid renderers ---
function renderGrid(ownedSet, borrowedSet) {
  const grid = byId("cardGrid");
  if (!grid) return;
  grid.innerHTML = "";

  for (let i = 1; i <= TOTAL_CARDS; i++) {
    const cid = `card${i}`;
    const owned    = ownedSet?.has(cid);
    const borrowed = borrowedSet?.has(cid);

    const card = document.createElement("div");

    if (owned || borrowed) {
      card.className = "card unlocked";
      card.style.backgroundImage = `url(assets/cards/${cid}.png)`;
      if (borrowed && !owned) {
        // visually lighter border for borrowed
        card.style.border    = "2.5px solid #ffcdd2";
        card.style.boxShadow = "0 4px 18px rgba(255,205,210,.7)";
        card.title = `Card ${i} (borrowed)`;
      } else {
        card.title = `Card ${i}`;
      }

      card.addEventListener("click", () => {
        const label = borrowed && !owned
          ? `Card ${i} <small style="color:#b71c1c">(borrowed)</small>`
          : `Card ${i}`;
        showModal(
          `<img src="assets/cards/${cid}.png" alt="Card ${i}" style="max-width:220px;border-radius:12px;">
           <div style="margin-top:1em;">${label}</div>`
        );
      });
    } else {
      card.className = "card locked";
      card.innerHTML = `<span class="lock-icon">&#128274;</span>`;
    }

    card.innerHTML += `<span class="card-num">${i}</span>`;
    grid.appendChild(card);
  }
}

// draw 25 locked tiles immediately so page is never blank
function renderAllLocked() {
  renderGrid(new Set(), new Set());
}

/* --- NEW: convert a borrowed card to owned (idempotent) --- */
async function convertBorrowToOwner(uid, cardId, fromUid){
  // 1) Add to cards[], 2) delete shared doc
  await db.runTransaction(async (tx)=>{
    const uref = db.collection('users').doc(uid);
    tx.set(uref, { cards: firebase.firestore.FieldValue.arrayUnion(cardId) }, { merge: true });
    tx.delete( uref.collection('shared').doc(cardId) );
  });

  // 3) Mark latest shareInbox for this card as converted (optional)
  const q = await db.collection('shareInbox')
    .where('toUid','==', uid)
    .where('cardId','==', cardId)
    .orderBy('createdAt','desc')
    .limit(1).get();
  if (!q.empty){
    await q.docs[0].ref.update({
      status: 'converted',
      acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
}

// --- Start ---
auth.onAuthStateChanged(async (user) => {
  if (!user) { location.href = "login.html"; return; }
  setupSidebar();

  // Always show something first
  renderAllLocked();

  const docRef = db.collection("users").doc(user.uid);

  // Ensure user doc exists WITHOUT wiping cards
  const firstSnap = await docRef.get();
  if (!firstSnap.exists) {
    await docRef.set({
      username: (user.email || "").split("@")[0] || "user",
      cards: [],
      mission: Array(15).fill(false),
      points: 0
    }); // create fresh doc only once
  } else {
    const data = firstSnap.data() || {};
    if (!data.username) {
      await docRef.set({
        username: (user.email || "").split("@")[0] || "user"
      }, { merge: true }); // don't touch cards here
    }
  }

  // Keep two live sets and re-render when either changes
  const ownedSet    = new Set();
  const borrowedSet = new Set();

  // Fallback: if listener is slow, do a one-time get after 2s
  let didFirstRender = false;
  setTimeout(async () => {
    if (!didFirstRender) {
      try {
        const snap2 = await docRef.get();
        const data2  = snap2.exists ? (snap2.data() || {}) : {};
        const cards2 = Array.isArray(data2.cards) ? data2.cards : [];
        ownedSet.clear(); cards2.forEach(c => ownedSet.add(c));
        renderGrid(ownedSet, borrowedSet);
      } catch { /* ignore */ }
    }
  }, 2000);

  // 1) Live OWNED cards
  docRef.onSnapshot((snap) => {
    const data  = snap.exists ? (snap.data() || {}) : {};
    const cards = Array.isArray(data.cards) ? data.cards : [];
    ownedSet.clear(); cards.forEach(c => ownedSet.add(c));
    renderGrid(ownedSet, borrowedSet);
    didFirstRender = true;
  }, (err) => {
    console.warn("users doc listener error:", err);
    renderGrid(ownedSet, borrowedSet);
  });

  // 2) Live BORROWED cards with auto-convert when expired
  docRef.collection("shared").onSnapshot(async (qs) => {
    borrowedSet.clear();
    const now = Date.now();

    for (const d of qs.docs){
      const v = d.data() || {};
      const cid   = v.cardId;
      const until = v.until?.toDate ? v.until.toDate().getTime() : 0;

      if (cid && until && until <= now){
        // Borrow expired → make it theirs now
        await convertBorrowToOwner(user.uid, cid, v.fromUid);
        continue; // do not display as borrowed
      }
      if (typeof cid === "string") borrowedSet.add(cid);
    }

    renderGrid(ownedSet, borrowedSet);
  }, (err) => {
    console.warn("shared listener error:", err);
    renderGrid(ownedSet, borrowedSet);
  });
});
