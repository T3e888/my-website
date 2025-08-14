// profile.js
const auth = firebase.auth();
const db   = firebase.firestore();

// ---------- Sidebar ----------
function setupSidebar() {
  const toggleBtn = document.getElementById("menu-toggle");
  const sidebar   = document.getElementById("sidebar");
  const overlay   = document.getElementById("overlay");
  const closeBtn  = document.getElementById("close-sidebar");
  const logout    = document.getElementById("logout-link");

  const open  = () => { sidebar.classList.add("open");  overlay.classList.add("active"); };
  const close = () => { sidebar.classList.remove("open"); overlay.classList.remove("active"); };

  toggleBtn?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  overlay?.addEventListener("click", close);
  document.querySelectorAll("#sidebar .menu-item a").forEach(a=>{
    if (!a.closest("#logout-link")) a.addEventListener("click", close);
  });
  logout?.addEventListener("click", (e)=>{ e.preventDefault(); auth.signOut().then(()=>location.href="login.html"); });
}

// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);
const toastEl = $("toast");
function toast(t){ toastEl.textContent = t; toastEl.classList.add("show"); setTimeout(()=>toastEl.classList.remove("show"), 1600); }

// ---------- App ----------
auth.onAuthStateChanged(async (user) => {
  if (!user) { location.href = "login.html"; return; }
  setupSidebar();

  $("uid").textContent        = user.uid;
  $("email").textContent      = user.email || "(no email)";
  $("displayName").textContent= (user.email||"").split("@")[0];

  const docRef = db.collection("users").doc(user.uid);

  // Ensure user doc exists (merge doesn’t overwrite)
  await docRef.set({
    username: (user.email||"").split("@")[0],
    cards: [],
    mission: Array(15).fill(false),
    points: 0
  }, { merge: true });

  // Load current data
  const snap = await docRef.get();
  const data = snap.data() || {};

  $("username").value      = data.username || (user.email||"").split("@")[0];
  $("about").value         = data.about || "";
  $("points").textContent  = String(data.points || 0);

  // Render cards (from users/{uid}.cards array)
  const cards = Array.isArray(data.cards) ? data.cards : [];
  $("cardsCount").textContent = String(cards.length);
  const grid = $("cardsGrid");
  grid.innerHTML = cards.length
    ? cards.map(cId => {
        const img = `assets/cards/${cId}.png`;      // e.g. assets/cards/card1.png
        const label = cId.replace(/card/i,"Card ");
        return `<div class="cardItem"><img src="${img}" alt="${label}" /><div class="muted">${label}</div></div>`;
      }).join("")
    : `<div class="muted">No cards yet.</div>`;

  // Save username
  $("saveUserBtn").onclick = async () => {
    const name = $("username").value.trim();
    $("saveUserMsg").textContent = "";
    if (!name) { $("saveUserMsg").textContent = "Enter a username."; return; }
    try {
      await docRef.set({ username: name }, { merge: true });
      $("displayName").textContent = name;
      toast("Username updated");
    } catch (e) {
      $("saveUserMsg").textContent = e.message || String(e);
    }
  };

  // Save about
  $("saveAboutBtn").onclick = async () => {
    const about = $("about").value.trim();
    $("saveAboutMsg").textContent = "";
    try {
      await docRef.set({ about }, { merge: true });
      toast("Saved");
    } catch (e) {
      $("saveAboutMsg").textContent = e.message || String(e);
    }
  };

  // Change password (re-auth)
  $("changePassBtn").onclick = async () => {
    const cur = $("curPass").value;
    const nw  = $("newPass").value;
    $("passMsg").textContent = "";
    if (!cur || !nw) { $("passMsg").textContent = "Fill both fields."; return; }

    try {
      const cred = firebase.auth.EmailAuthProvider.credential(user.email, cur);
      await user.reauthenticateWithCredential(cred);
      await user.updatePassword(nw);
      $("curPass").value = ""; $("newPass").value = "";
      toast("Password changed");
    } catch (e) {
      $("passMsg").textContent = e.message || String(e);
    }
  };

  // Sign out (backup if user clicks the button in content)
  $("signOutBtn").onclick = () => auth.signOut().then(()=>location.href="login.html");
});
const uname = name.trim().toLowerCase();
await db.collection('usernames').doc(uname).set({ uid: user.uid, username: uname });
