// profile.js
const auth = firebase.auth();
const db   = firebase.firestore();

const $ = (id) => document.getElementById(id);
const toastEl = $("toast");
const toast = (t) => { toastEl.textContent = t; toastEl.classList.add("show"); setTimeout(()=>toastEl.classList.remove("show"), 1600); };

auth.onAuthStateChanged(async (user) => {
  if (!user) { location.href = "login.html"; return; }

  // Show basic auth info
  $("uid").textContent = user.uid;
  $("email").textContent = user.email || "(no email)";
  $("displayName").textContent = (user.email||"").split("@")[0];

  const docRef = db.collection("users").doc(user.uid);

  // Ensure user doc exists
  await docRef.set({
    username: (user.email||"").split("@")[0],
    cards: [],
    mission: Array(15).fill(false),
    points: 0
  }, { merge: true });

  // Load profile data
  const snap = await docRef.get();
  const data = snap.data() || {};

  $("username").value = data.username || (user.email||"").split("@")[0];
  $("about").value    = data.about || "";
  $("points").textContent = String(data.points || 0);

  // Render cards
  const cards = Array.isArray(data.cards) ? data.cards : [];
  $("cardsCount").textContent = String(cards.length);
  const grid = $("cardsGrid");
  grid.innerHTML = cards.map(cId => {
    // cId is like "card1" → image at /assets/cards/card1.png
    const img = `assets/cards/${cId}.png`;
    const label = cId.replace("card","Card ");
    return `<div class="cardItem"><img src="${img}" alt="${label}" /><div class="muted">${label}</div></div>`;
  }).join("") || `<div class="muted">No cards yet.</div>`;

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

  // Change password (re-auth + update)
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

  // Sign out
  $("signOutBtn").onclick = () => auth.signOut().then(()=>location.href="login.html");
});
