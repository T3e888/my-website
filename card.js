// ========== card.js (no reset + self-heal) ==========

const byId = (id) => document.getElementById(id);
const TOTAL_CARDS = 30;

/* ---------- Sidebar ---------- */
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

  document.querySelectorAll("#sidebar .menu-item a").forEach(a=>{
    if (!a.closest("#logout-link")) a.addEventListener("click", close);
  });
}

/* ---------- Modal ---------- */
function showModal(html) {
  const modal = byId("modal");
  if (!modal) return;
  modal.innerHTML = `<div class="modal-content">${html}<br><button class="modal-close">OK</button></div>`;
  modal.classList.add("active");
  modal.querySelector(".modal-close").onclick = () => modal.classList.remove("active");
}

/* ---------- Rendering ---------- */
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

function renderAllLocked() { renderGrid(new Set(), new Set()); }

/* ---------- Self-heal from cardKeys ---------- */
async function healOwnedCards(uid) {
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

/* ---------- Self-heal for feedback reward (card25 + +5) ---------- */
async function ensureFeedbackAwardApplied(uid, data){
  const flags = data.flags || {};
  if (!flags.feedbackAwardGiven) return;

  const cards = Array.isArray(data.cards) ? data.cards : [];
  const hasCard25 = cards.includes('card25');

  if (hasCard25) {
    // mark that it’s already applied so we never double-fix
    if (!flags.feedbackAwardPatched) {
      await db.collection('users').doc(uid).set({ flags: { feedbackAwardPatched: true } }, { merge: true });
    }
    return;
  }

  // If award was given but card is missing (e.g., doc got overwritten),
  // restore card25 and the +5 once, then mark as patched.
  await db.collection('users').doc(uid).set({
    cards:  firebase.firestore.FieldValue.arrayUnion('card25'),
    points: firebase.firestore.FieldValue.increment(5),
    flags: {
      feedbackAwardPatched: true,
      pointsFromFeedbackApplied: true
    }
  }, { merge: true });
}

/* ---------- Start ---------- */
auth.onAuthStateChanged(async (user) => {
  if (!user) { location.href = "login.html"; return; }
  setupSidebar();

  renderAllLocked();

  const docRef = db.collection("users").doc(user.uid);

  // Ensure the user doc exists (never wipe existing fields)
  const firstSnap = await docRef.get();
  if (!firstSnap.exists) {
    await docRef.set({
      username: (user.email || "").split("@")[0] || "user",
      cards: [],
      mission: Array(15).fill(false),
      points: 0,
      flags: { feedbackDone:false, befastDone:false, feedbackAwardGiven:false }
    }, { merge: true });
  } else if (!(firstSnap.data() || {}).username) {
    await docRef.set({
      username: (user.email || "").split("@")[0] || "user"
    }, { merge: true });
  }

  const ownedSet    = new Set();
  const borrowedSet = new Set();
  let didFirstRender = false;
  let healedOnce = false;

  setTimeout(async () => {
    if (!didFirstRender) {
      try {
        const snap = await docRef.get();
        const data  = snap.exists ? (snap.data() || {}) : {};
        const cards = Array.isArray(data.cards) ? data.cards : [];
        ownedSet.clear(); cards.forEach(c => ownedSet.add(c));
        renderGrid(ownedSet, borrowedSet);
      } catch {}
    }
  }, 1500);

  // Live owned cards
  docRef.onSnapshot(async (snap) => {
    const data  = snap.exists ? (snap.data() || {}) : {};
    const cards = Array.isArray(data.cards) ? data.cards : [];

    // Self-heal feedback award if needed
    ensureFeedbackAwardApplied(user.uid, data).catch(()=>{});

    if (!healedOnce && cards.length === 0) {
      healedOnce = true;
      const healed = await healOwnedCards(user.uid);
      if (healed) return; // will re-render on next snapshot
    }

    ownedSet.clear(); cards.forEach(c => ownedSet.add(c));
    renderGrid(ownedSet, borrowedSet);
    didFirstRender = true;
  }, (err) => {
    console.warn("users doc listener error:", err);
    renderGrid(ownedSet, borrowedSet);
  });

  // Live borrowed cards (optional; used by Share)
  docRef.collection("shared").onSnapshot((qs) => {
    borrowedSet.clear();
    qs.forEach(d => {
      const v = d.data();
      if (v && typeof v.cardId === "string") borrowedSet.add(v.cardId);
    });
    renderGrid(ownedSet, borrowedSet);
  }, (err) => {
    console.warn("shared listener error:", err);
    renderGrid(ownedSet, borrowedSet);
  });
});
