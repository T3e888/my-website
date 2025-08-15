// ========== card.js (robust render, no more cards reset) ==========
const byId = (id) => document.getElementById(id);
const TOTAL_CARDS = 25;

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

function showModal(html) {
  const modal = byId("modal");
  if (!modal) return;
  modal.innerHTML = `<div class="modal-content">${html}<br><button class="modal-close">OK</button></div>`;
  modal.classList.add("active");
  modal.querySelector(".modal-close").onclick = () => modal.classList.remove("active");
}

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

auth.onAuthStateChanged(async (user) => {
  if (!user) { location.href = "login.html"; return; }
  setupSidebar();
  renderAllLocked();

  const docRef = db.collection("users").doc(user.uid);

  // Create if missing, but NEVER clear cards again
  const first = await docRef.get();
  if (!first.exists) {
    await docRef.set({
      username: (user.email || "").split("@")[0] || "user",
      cards: [],
      mission: Array(15).fill(false),
      points: 0
    });
  } else {
    const data = first.data() || {};
    if (!data.username) {
      await docRef.set({
        username: (user.email || "").split("@")[0] || "user",
        mission: Array(15).fill(false),
        points: 0
      }, { merge: true });
    }
  }

  const ownedSet    = new Set();
  const borrowedSet = new Set();

  let didFirstRender = false;
  setTimeout(async () => {
    if (!didFirstRender) {
      try {
        const snap2 = await docRef.get();
        const data2  = snap2.exists ? (snap2.data() || {}) : {};
        const cards2 = Array.isArray(data2.cards) ? data2.cards : [];
        ownedSet.clear(); cards2.forEach(c => ownedSet.add(c));
        renderGrid(ownedSet, borrowedSet);
      } catch {}
    }
  }, 2000);

  docRef.onSnapshot((snapLive) => {
    const data  = snapLive.exists ? (snapLive.data() || {}) : {};
    const cards = Array.isArray(data.cards) ? data.cards : [];
    ownedSet.clear(); cards.forEach(c => ownedSet.add(c));
    renderGrid(ownedSet, borrowedSet);
    didFirstRender = true;
  }, () => renderGrid(ownedSet, borrowedSet));

  docRef.collection("shared").onSnapshot((qs) => {
    borrowedSet.clear();
    qs.forEach(d => { const v = d.data(); if (v && typeof v.cardId === "string") borrowedSet.add(v.cardId); });
    renderGrid(ownedSet, borrowedSet);
  }, () => renderGrid(ownedSet, borrowedSet));
});
