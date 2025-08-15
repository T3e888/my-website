// ========== card.js (robust render, no cards reset) ==========
const byId = (id) => document.getElementById(id);
const TOTAL_CARDS = 25;

// --- Sidebar ---
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
        card.style.border    = "2.5px solid #ffcdd2";                // light red for borrowed
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

// draw all locked first so page is never blank
function renderAllLocked() {
  renderGrid(new Set(), new Set());
}

// --- Start ---
auth.onAuthStateChanged(async (user) => {
  if (!user) { location.href = "login.html"; return; }
  setupSidebar();
  renderAllLocked();

  const docRef = db.collection("users").doc(user.uid);

  // Ensure user doc exists WITHOUT clearing cards
  const firstSnap = await docRef.get();
  if (!firstSnap.exists) {
    // First time: create with empty cards (only once)
    await docRef.set({
      username: (user.email || "").split("@")[0] || "user",
      cards: [],
      mission: Array(15).fill(false),
      points: 0
    });
  } else {
    // If username missing, fill it; DO NOT touch cards here
    const data = firstSnap.data() || {};
    if (!data.username) {
      await docRef.set({
        username: (user.email || "").split("@")[0] || "user",
        mission: Array(15).fill(false),
        points: 0
      }, { merge: true });
    }
  }

  // Live sets
  const ownedSet    = new Set();
  const borrowedSet = new Set();

  // Fallback one-time get if listener is slow
  let didFirstRender = false;
  setTimeout(async () => {
    if (!didFirstRender) {
      try {
        const s = await docRef.get();
        const data  = s.exists ? (s.data() || {}) : {};
        const cards = Array.isArray(data.cards) ? data.cards : [];
        ownedSet.clear(); cards.forEach(c => ownedSet.add(c));
        renderGrid(ownedSet, borrowedSet);
      } catch {}
    }
  }, 2000);

  // 1) Live owned cards
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

  // 2) Live borrowed cards (if you use Share feature)
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
