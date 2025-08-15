// card.js

// Sidebar
function setupSidebar() {
  const toggleBtn = document.getElementById("menu-toggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  const closeBtn = document.getElementById("close-sidebar");
  const menuItems = document.querySelectorAll("#sidebar .menu-item");
  const logout = document.getElementById("logout-link");

  toggleBtn.addEventListener("click", () => {
    sidebar.classList.add("open");
    overlay.classList.add("active");
  });
  function closeSidebar() {
    sidebar.classList.remove("open");
    overlay.classList.remove("active");
  }
  closeBtn.addEventListener("click", closeSidebar);
  overlay.addEventListener("click", closeSidebar);
  logout.addEventListener("click", function(e) {
    e.preventDefault();
    auth.signOut().then(() => window.location.href = "login.html");
  });
  menuItems.forEach(item => {
    if (item !== logout) item.addEventListener("click", closeSidebar);
  });
}

// Firebase
const auth = firebase.auth();
const db   = firebase.firestore();

auth.onAuthStateChanged(async function(user) {
  if (!user) return location.href = "login.html";
  setupSidebar();

  const docRef = db.collection('users').doc(user.uid);
  const userSnap = await docRef.get();
  const userData = userSnap.data() || {};
  const owned = Array.isArray(userData.cards) ? userData.cards.slice() : [];

  // fetch borrowed (shared subcollection)
  const sharedSnap = await db.collection('users').doc(user.uid).collection('shared').get();
  const borrowed = new Set(sharedSnap.docs.map(d => d.id)); // doc id == cardId

  const grid = document.getElementById("cardGrid");
  grid.innerHTML = "";
  for (let i = 1; i <= 25; ++i) {
    const cid = "card" + i;
    const div = document.createElement("div");

    if (owned.includes(cid)) {
      div.className = "card unlocked";
      div.style.backgroundImage = `url(assets/cards/${cid}.png)`;
      div.title = `Card ${i}`;
      div.onclick = () => showModal(`<img src="assets/cards/${cid}.png" alt="Card ${i}" style="max-width:220px;border-radius:12px;"><div style="margin-top:1em;">Card ${i} (owned)</div>`);
    } else if (borrowed.has(cid)) {
      div.className = "card borrowed";
      div.style.backgroundImage = `url(assets/cards/${cid}.png)`;
      div.title = `Card ${i} — borrowed`;
      div.onclick = () => showModal(`<img src="assets/cards/${cid}.png" alt="Card ${i}" style="max-width:220px;border-radius:12px;"><div style="margin-top:1em;">Card ${i} (borrowed)</div><div class="muted" style="margin-top:.3em">Borrowed cards will auto-convert to owner after the timer ends on the Share page.</div>`);
    } else {
      div.className = "card locked";
      div.innerHTML = `<span class="lock-icon">&#128274;</span>`;
    }

    div.innerHTML += `<span class="card-num">${i}</span>`;
    grid.appendChild(div);
  }

  function showModal(msg) {
    const modal = document.getElementById("modal");
    modal.innerHTML = `<div class="modal-content">${msg}<br><button class="modal-close">OK</button></div>`;
    modal.classList.add("active");
    modal.querySelector(".modal-close").onclick = () =>
      modal.classList.remove("active");
  }
});
