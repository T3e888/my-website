// profile.js — shared sidebar + profile + safe username mapping

// ===== Firebase handles =====
const auth = firebase.auth();
const db   = firebase.firestore();

// ===== Helpers =====
const $ = (id) => document.getElementById(id);
const toastEl = $("toast");
function toast(t){
  if (!toastEl) return alert(t);
  toastEl.textContent = t;
  toastEl.classList.add("show");
  setTimeout(()=>toastEl.classList.remove("show"), 1600);
}

// ===== Sidebar (matches other pages) =====
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

  // Close on nav (except logout)
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
async function ensureUsernameMapping(uid, uname){
  uname = String(uname||"").trim().toLowerCase();
  if (!uname) return;
  try {
    // Write either {uid} or {uid, username} (both allowed by your rules)
    await db.collection("usernames").doc(uname)
      .set({ uid, username: uname }, { merge: true });
  } catch(_) { /* ignore — rules protect collisions */ }
}

async function renameUsernameMapping(uid, oldU, newU){
  oldU = String(oldU||"").trim().toLowerCase();
  newU = String(newU||"").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,20}$/.test(newU)) {
    throw new Error("Username must be 3–20 chars (a-z, 0-9, dot, _, -).");
  }
  if (oldU === newU) return;

  // 1) Claim/write the new mapping (rules allow if free or already mine)
  await db.collection("usernames").doc(newU).set({ uid, username: newU }, { merge: true });

  // 2) Best-effort delete old mapping if it belonged to me
  if (oldU){
    try{
      const s = await db.collection("usernames").doc(oldU).get();
      if (s.exists && s.data()?.uid === uid){
        await db.collection("usernames").doc(oldU).delete();
      }
    }catch(_) { /* ignore */ }
  }
}

// ===== App =====
auth.onAuthStateChanged(async (user)=>{
  if (!user){ location.href = "login.html"; return; }

  setupSidebar();

  const uref = db.collection("users").doc(user.uid);

  // Seed (merge, never wipe)
  const emailName = (user.email||"").split("@")[0] || "user";
  await uref.set({
    username: emailName,
    about: "",
    cards: [],
    mission: Array(15).fill(false),
    points: 0,
    quizCount: 0,
    quizStreak: 0,
    quizLastYmd: null
  }, { merge: true });

  // Load
  const snap = await uref.get();
  const data = snap.data() || {};
  let currentUname = String(data.username || emailName).toLowerCase();

  // Fill header & fields
  $("uid")?.textContent         = user.uid;
  $("displayName")?.textContent = currentUname;       // ← big name at top
  $("username") && ($("username").value = currentUname);
  $("about")    && ($("about").value    = data.about || "");
  $("points")?.textContent     = String(data.points || 0);
  $("quizCount")?.textContent  = String(data.quizCount || 0);
  $("quizStreak")?.textContent = String(data.quizStreak || 0);

  // Keep mapping in /usernames
  await ensureUsernameMapping(user.uid, currentUname);

  // Cards grid
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

  // Actions — Save username
  $("saveUserBtn")?.addEventListener("click", async ()=>{
    const newName = ($("username")?.value || "").trim().toLowerCase();
    if ($("saveUserMsg")) $("saveUserMsg").textContent = "";
    if (!newName){ $("saveUserMsg")?.textContent = "Please enter a username."; return; }

    try{
      await renameUsernameMapping(user.uid, currentUname, newName);
      await uref.set({ username: newName }, { merge: true });
      $("displayName")?.textContent = newName;
      currentUname = newName; // keep in sync
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

  // Change password
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

// Bind sidebar even if script loads early
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupSidebar, { once:true });
} else {
  setupSidebar();
    }
