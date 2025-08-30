// profile.js — Sidebar + Profile + Username mapping
console.log('profile.js vth-9 loaded');

// ===== Firebase handles =====
const auth = firebase.auth();
const db   = firebase.firestore();

// ===== Small helpers =====
const $ = (id) => document.getElementById(id);
const toastEl = $("toast");
function toast(t){
  if (!toastEl) return alert(t);
  toastEl.textContent = t;
  toastEl.classList.add("show");
  setTimeout(()=>toastEl.classList.remove("show"), 1600);
}

// ===== Sidebar (safe bindings) =====
function setupSidebar(){
  const toggleBtn = $("menu-toggle");
  const sidebar   = $("sidebar");
  const overlay   = $("overlay");
  const closeBtn  = $("close-sidebar");
  const logout    = $("logout-link");

  const open  = ()=>{ sidebar?.classList.add("open");  overlay?.classList.add("active"); };
  const close = ()=>{ sidebar?.classList.remove("open"); overlay?.classList.remove("active"); };

  toggleBtn?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  overlay?.addEventListener("click", close);

  // Close when navigating (except logout)
  document.querySelectorAll("#sidebar .menu-item a").forEach(a=>{
    if (!a.closest("#logout-link")) a.addEventListener("click", close);
  });

  // Logout
  logout?.addEventListener("click", (e)=>{
    e.preventDefault();
    auth.signOut().then(()=>location.href="login.html");
  });
}

// ===== Username mapping helpers =====
// Ensure usernames/{username} → { uid, username } exists (or is already mine).
async function ensureUsernameMapping(uid, uname){
  if (!uname) return;
  uname = String(uname).trim().toLowerCase();
  if (!uname) return;
  try {
    await db.collection("usernames").doc(uname)
      .set({ uid, username: uname }, { merge: true });
  } catch(_) {/* ignore — rules will protect collisions */}
}

// Change username mapping safely
async function renameUsernameMapping(uid, oldU, newU){
  oldU = String(oldU||"").trim().toLowerCase();
  newU = String(newU||"").trim().toLowerCase();
  if (!newU) throw new Error("Please enter a username.");
  if (oldU === newU) return;

  if (oldU){
    try{
      const s = await db.collection("usernames").doc(oldU).get();
      if (s.exists && s.data()?.uid === uid){
        await db.collection("usernames").doc(oldU).delete();
      }
    }catch(_) {/* best effort */}
  }
  await db.collection("usernames").doc(newU).set({ uid, username: newU });
}

// ===== App =====
auth.onAuthStateChanged(async (user)=>{
  if (!user){ location.href = "login.html"; return; }

  // sidebar first
  setupSidebar();

  // Basic header placeholders
  $("uid")?.textContent         = user.uid;
  $("displayName")?.textContent = (user.email||"").split("@")[0];

  const uref = db.collection("users").doc(user.uid);

  // Seed doc (merge so we never wipe existing)
  await uref.set({
    username: (user.email||"").split("@")[0] || "user",
    about: "",
    cards: [],
    mission: Array(15).fill(false),
    points: 0,
    quizCount: 0,
    quizStreak: 0,
    quizLastYmd: null
  }, { merge: true });

  // Load current data
  const snap = await uref.get();
  const data = snap.data() || {};
  let currentUname = String(
    data.username || (user.email||"").split("@")[0] || ""
  ).toLowerCase();

  // Show the Firestore username immediately (fixes old email fallback)
  $("displayName")?.textContent = currentUname || (user.email||"").split("@")[0];

  // Fill UI
  if ($("username")) $("username").value = currentUname;
  if ($("about"))    $("about").value    = data.about || "";
  $("points")?.textContent     = String(data.points || 0);
  $("quizCount")?.textContent  = String(data.quizCount || 0);
  $("quizStreak")?.textContent = String(data.quizStreak || 0);

  // Keep username ↔ uid mapping in /usernames
  await ensureUsernameMapping(user.uid, currentUname);

  // Render cards
  const cards = Array.isArray(data.cards) ? data.cards : [];
  $("cardsCount")?.textContent = String(cards.length);
  const grid = $("cardsGrid");
  if (grid){
    if (!cards.length){
      grid.innerHTML = `<div class="muted">No cards yet.</div>`;
    } else {
      const html = cards
        .slice()
        .sort((a,b)=>Number(a.replace('card',''))-Number(b.replace('card','')))
        .map(cId=>{
          const n = cId.replace(/card/i,"Card ");
          return `
            <div class="cardItem">
              <img src="assets/cards/${cId}.png"
                   alt="${n}"
                   onerror="this.onerror=null;this.src='assets/cards/${cId}.jpg'">
              <div class="muted">${n}</div>
            </div>`;
        }).join("");
      grid.innerHTML = html;
    }
  }

  // ===== Actions =====
  // Save username
  $("saveUserBtn")?.addEventListener("click", async ()=>{
    const newName = ($("username")?.value || "").trim().toLowerCase();
    if ($("saveUserMsg")) $("saveUserMsg").textContent = "";
    if (!newName){ $("saveUserMsg")?.textContent = "Please enter a username."; return; }

    try{
      await renameUsernameMapping(user.uid, currentUname, newName);
      await uref.set({ username: newName }, { merge: true });
      $("displayName")?.textContent = newName;
      currentUname = newName;                 // keep in sync for future renames
      toast("Username updated");
    }catch(e){
      $("saveUserMsg")?.textContent = e?.message || String(e);
    }
  });

  // Save "about me"
  $("saveAboutBtn")?.addEventListener("click", async ()=>{
    const about = ($("about")?.value || "").trim();
    if ($("saveAboutMsg")) $("saveAboutMsg").textContent = "";
    try{
      await uref.set({ about }, { merge: true });
      toast("Saved");
    }catch(e){
      $("saveAboutMsg")?.textContent = e?.message || String(e);
    }
  });

  // Change password (email/password users)
  $("changePassBtn")?.addEventListener("click", async ()=>{
    const cur = $("curPass")?.value || "";
    const nw  = $("newPass")?.value || "";
    if ($("passMsg")) $("passMsg").textContent = "";
    if (!cur || !nw){ $("passMsg")?.textContent = "Fill both fields."; return; }

    try{
      const cred = firebase.auth.EmailAuthProvider.credential(user.email, cur);
      await user.reauthenticateWithCredential(cred);
      await user.updatePassword(nw);
      if ($("curPass")) $("curPass").value = "";
      if ($("newPass")) $("newPass").value = "";
      toast("Password changed");
    }catch(e){
      $("passMsg")?.textContent = e?.message || String(e);
    }
  });

  // Sign out (secondary button)
  $("signOutBtn")?.addEventListener("click", ()=>{
    auth.signOut().then(()=>location.href="login.html");
  });
});

// Ensure sidebar hook even if JS loads before DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupSidebar, { once:true });
} else {
  setupSidebar();
}
