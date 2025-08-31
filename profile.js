// profile.js — sidebar + profile + username mapping (no other flows changed)

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

// ===== Sidebar (same pattern as other pages) =====
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

  document.querySelectorAll("#sidebar .menu-item a").forEach(a=>{
    if (!a.closest("#logout-link")) a.addEventListener("click", close);
  });

  logout?.addEventListener("click", (e)=>{
    e.preventDefault();
    auth.signOut().then(()=>location.href="login.html");
  });
}

// ===== Username mapping utilities =====
async function ensureUsernameMapping(uid, uname){
  uname = String(uname||"").trim().toLowerCase();
  if (!uname) return;
  // Rules allow {uid} or {uid, username}
  await db.collection("usernames").doc(uname)
    .set({ uid, username: uname }, { merge: true });
}

async function renameUsernameMapping(uid, oldU, newU){
  oldU = String(oldU||"").trim().toLowerCase();
  newU = String(newU||"").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,20}$/.test(newU)) {
    throw new Error("Username must be 3–20 chars (a-z, 0-9, dot, _, -).");
  }
  if (oldU === newU) return;

  // Try claiming/writing new mapping; rules allow if free or already mine
  await db.collection("usernames").doc(newU).set({ uid, username: newU }, { merge: true });

  // Best-effort delete old mapping if it belonged to me
  if (oldU){
    try{
      const s = await db.collection("usernames").doc(oldU).get();
      if (s.exists && s.data()?.uid === uid){
        await db.collection("usernames").doc(oldU).delete();
      }
    }catch{ /* ignore */ }
  }
}

/* === NEW: one-time identity hook ===
   Makes sure /users/{uid} has a username and /usernames/{name} -> {uid}
   If the desired name is taken, it auto-suffixes -xxxx (first 4 of uid). */
async function ensureIdentity(user){
  const uref = db.collection("users").doc(user.uid);

  // Load current data (if any)
  const snap = await uref.get();
  const data = snap.exists ? (snap.data() || {}) : {};

  // Compute a base username
  const emailName = (user.email||"").split("@")[0] || "user";
  let uname = String(data.username || emailName).trim().toLowerCase()
               .replace(/[^a-z0-9._-]/g,"");
  if (uname.length < 3) uname = `user-${user.uid.slice(0,4).toLowerCase()}`;

  // Ensure /users/{uid} exists (merge, never wipe)
  await uref.set({
    username: uname,
    about: data.about || "",
    cards: Array.isArray(data.cards) ? data.cards : [],
    mission: Array.isArray(data.mission) ? data.mission : Array(15).fill(false),
    points: Number.isFinite(data.points) ? data.points : 0,
    quizCount: Number.isFinite(data.quizCount) ? data.quizCount : 0,
    quizStreak: Number.isFinite(data.quizStreak) ? data.quizStreak : 0,
    quizLastYmd: data.quizLastYmd || null
  }, { merge: true });

  // Ensure /usernames/{uname} -> { uid }
  try{
    await ensureUsernameMapping(user.uid, uname);
  }catch{
    // If taken by someone else, suffix and write both places
    const fallback = `${uname}-${user.uid.slice(0,4).toLowerCase()}`;
    await db.collection("usernames").doc(fallback)
      .set({ uid: user.uid, username: fallback }, { merge: true });
    await uref.set({ username: fallback }, { merge: true });
    uname = fallback;
  }

  // Return fresh data + final uname
  const finalSnap = await uref.get();
  return { data: finalSnap.data() || {}, uname };
}

// ===== App =====
auth.onAuthStateChanged(async (user)=>{
  if (!user){ location.href = "login.html"; return; }

  setupSidebar();

  try{
    // Ensure identity and mapping first
    const { data, uname } = await ensureIdentity(user);

    // Fill header & fields
    $("uid")?.textContent         = user.uid;
    $("displayName")?.textContent = uname;
    if ($("username")) $("username").value = uname;
    if ($("about"))    $("about").value    = data.about || "";
    $("points")?.textContent     = String(data.points || 0);
    $("quizCount")?.textContent  = String(data.quizCount || 0);
    $("quizStreak")?.textContent = String(data.quizStreak || 0);

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

    // Save username
    $("saveUserBtn")?.addEventListener("click", async ()=>{
      const newName = ($("username")?.value || "").trim().toLowerCase();
      if ($("saveUserMsg")) $("saveUserMsg").textContent = "";
      if (!newName){ $("saveUserMsg")?.textContent = "Please enter a username."; return; }

      try{
        await renameUsernameMapping(user.uid, uname, newName);
        await db.collection("users").doc(user.uid).set({ username: newName }, { merge: true });
        $("displayName")?.textContent = newName;
        if ($("username")) $("username").value = newName;
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
        await db.collection("users").doc(user.uid).set({ about }, { merge: true });
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

  }catch(err){
    // Minimal debug surface (doesn't change layout)
    const dbg = $("debug");
    if (dbg){
      dbg.classList.remove("hidden");
      dbg.textContent = `Profile init error: ${err?.message || err}`;
    } else {
      console.error(err);
    }
  }
});

// Bind sidebar even if script loads early
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupSidebar, { once:true });
} else {
  setupSidebar();
    }
