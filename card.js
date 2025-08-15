// card.js (safe + borrowed support)
function setupSidebar() {
  const toggleBtn = document.getElementById("menu-toggle");
  const sidebar   = document.getElementById("sidebar");
  const overlay   = document.getElementById("overlay");
  const closeBtn  = document.getElementById("close-sidebar");
  const logout    = document.getElementById("logout-link");

  const open  = () => { sidebar.classList.add("open"); overlay.classList.add("active"); };
  const close = () => { sidebar.classList.remove("open"); overlay.classList.remove("active"); };

  toggleBtn?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  overlay?.addEventListener("click", close);
  logout?.addEventListener("click", (e)=>{ e.preventDefault(); auth.signOut().then(()=>location.href="login.html"); });
}

function showModal(msg) {
  const modal = document.getElementById("modal");
  modal.innerHTML = `<div class="modal-content">${msg}<br><button class="modal-close">OK</button></div>`;
  modal.classList.add("active");
  modal.querySelector(".modal-close").onclick = () => modal.classList.remove("active");
}

function renderGrid(owned = [], borrowed = []) {
  const grid = document.getElementById("cardGrid");
  grid.innerHTML = "";
  for (let i = 1; i <= 25; i++) {
    const cid = `card${i}`;
    const isOwned    = owned.includes(cid);
    const isBorrowed = !isOwned && borrowed.includes(cid);

    const div = document.createElement("div");
    div.className = "card " + (isOwned ? "unlocked" : (isBorrowed ? "borrowed" : "locked"));

    if (isOwned || isBorrowed) {
      div.style.backgroundImage = `url(assets/cards/${cid}.png)`;
      div.title = `Card ${i}`;
    } else {
      div.innerHTML = `<span class="lock-icon">&#128274;</span>`;
    }
    div.innerHTML += `<span class="card-num">${i}</span>`;

    div.onclick = () => {
      if (isOwned || isBorrowed) {
        showModal(
          `<img src="assets/cards/${cid}.png" alt="Card ${i}" style="max-width:220px;border-radius:12px;">
           <div style="margin-top:1em;">Card ${i}${isBorrowed ? ' <span style="font-size:.9em;color:#d32f2f">(borrowed)</span>' : ''}</div>`
        );
      }
    };
    grid.appendChild(div);
  }
}

auth.onAuthStateChanged(async (user) => {
  if (!user) { location.href = "login.html"; return; }
  setupSidebar();

  try {
    const uref = db.collection("users").doc(user.uid);

    // Ensure the doc exists (merge = safe/no overwrite of existing fields)
    await uref.set({
      username: (user.email || "").split("@")[0],
      cards: [],
      mission: Array(15).fill(false),
      points: 0
    }, { merge: true });

    // Load owned cards
    const snap = await uref.get();
    const data = snap.exists ? (snap.data() || {}) : {};
    const owned = Array.isArray(data.cards) ? data.cards : [];

    // Try to load borrowed cards (ok if none)
    let borrowed = [];
    try {
      const bor = await uref.collection("shared").get();
      borrowed = bor.docs.map(d => d.id || (d.data()?.cardId)).filter(Boolean);
    } catch { borrowed = []; }

    renderGrid(owned, borrowed);
  } catch (e) {
    console.error("card.js error:", e);
    // Render a fully locked grid so the page never looks empty
    renderGrid([], []);
    showModal("Small loading error. Please refresh.");
  }
});
