// ========== card.js (updated) ==========

// --- Sidebar logic (same as your latest) ---
function setupSidebar() {
  const toggleBtn = document.getElementById("menu-toggle");
  const sidebar   = document.getElementById("sidebar");
  const overlay   = document.getElementById("overlay");
  const closeBtn  = document.getElementById("close-sidebar");
  const menuItems = document.querySelectorAll("#sidebar .menu-item");
  const logout    = document.getElementById("logout-link");

  const open  = () => { sidebar.classList.add("open");  overlay.classList.add("active"); };
  const close = () => { sidebar.classList.remove("open"); overlay.classList.remove("active"); };

  toggleBtn?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  overlay?.addEventListener("click", close);

  logout?.addEventListener("click", (e) => {
    e.preventDefault();
    auth.signOut().then(() => (window.location.href = "login.html"));
  });

  menuItems.forEach(item => {
    if (item !== logout) item.addEventListener("click", close);
  });
}

// --- Small helpers ---
const byId = (id) => document.getElementById(id);
const TOTAL_CARDS = 25;

// Modal
function showModal(html) {
  const modal = byId("modal");
  modal.innerHTML = `<div class="modal-content">${html}<br><button class="modal-close">OK</button></div>`;
  modal.classList.add("active");
  modal.querySelector(".modal-close").onclick = () => modal.classList.remove("active");
}

// Render grid from owned + borrowed sets
function renderGrid(ownedSet, borrowedSet) {
  const grid = byId("cardGrid");
  if (!grid) return;

  grid.innerHTML = "";

  for (let i = 1; i <= TOTAL_CARDS; i++) {
    const cid = `card${i}`;
    const isOwned    = ownedSet.has(cid);
    const isBorrowed = borrowedSet.has(cid);

    const div = document.createElement("div");

    if (isOwned || isBorrowed) {
      // use the unlocked style so the image shows
      div.className = "card unlocked";
      div.style.backgroundImage = `url(assets/cards/${cid}.png)`;
      // tweak border color for borrowed without needing new CSS
      if (isBorrowed && !isOwned) {
        div.style.border = "2.5px solid #ffcdd2";     // light red for borrowed
        div.style.boxShadow = "0 4px 18px rgba(255,205,210,.7)";
        div.title = `Card ${i} (borrowed)`;
      } else {
        div.title = `Card ${i}`;
      }
    } else {
      div.className = "card locked";
      div.innerHTML = `<span class="lock-icon">&#128274;</span>`;
    }

    div.innerHTML += `<span class="card-num">${i}</span>`;

    // Click to preview only if visible
    if (isOwned || isBorrowed) {
      div.addEventListener("click", () => {
        const label = isBorrowed && !isOwned ? `Card ${i} <small style="color:#b71c1c">(borrowed)</small>` : `Card ${i}`;
        showModal(
          `<img src="assets/cards/${cid}.png" alt="Card ${i}" style="max-width:220px;border-radius:12px;">
           <div style="margin-top:1em;">${label}</div>`
        );
      });
    }

    grid.appendChild(div);
  }
}

// --- Main ---
auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = "login.html"; return; }
  setupSidebar();

  const docRef = db.collection("users").doc(user.uid);

  // Ensure the user doc exists so reads never fail
  await docRef.set({
    username: (user.email || "").split("@")[0] || "user",
    cards: [],
    mission: Array(15).fill(false),
    points: 0
  }, { merge: true });

  // We’ll keep live sets and re-render when either changes
  const ownedSet    = new Set();
  const borrowedSet = new Set();

  // 1) Live owned cards
  docRef.onSnapshot((snap) => {
    const data = snap.exists ? (snap.data() || {}) : {};
    const cards = Array.isArray(data.cards) ? data.cards : [];
    ownedSet.clear();
    cards.forEach(c => ownedSet.add(c));
    renderGrid(ownedSet, borrowedSet);
  }, (err) => {
    console.warn("users doc listener error:", err);
    renderGrid(ownedSet, borrowedSet); // still draw something
  });

  // 2) Live borrowed cards from /users/{uid}/shared
  //    (If you don’t use the Share feature yet, you can remove this block.)
  docRef.collection("shared").onSnapshot((qs) => {
    borrowedSet.clear();
    qs.forEach(d => {
      const v = d.data();
      if (v && typeof v.cardId === "string") borrowedSet.add(v.cardId);
    });
    renderGrid(ownedSet, borrowedSet);
  }, (err) => {
    // If rules block this or collection doesn’t exist, just render owned.
    console.warn("shared listener error:", err);
    renderGrid(ownedSet, borrowedSet);
  });
});
```0
