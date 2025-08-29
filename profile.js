<script>
// profile.js — robust username mapping with transaction + live UI

const auth = firebase.auth();
const db   = firebase.firestore();

const $ = (id) => document.getElementById(id);
const toastEl = $("toast");
const toast = (t)=>{ if(!toastEl) return alert(t); toastEl.textContent=t; toastEl.classList.add("show"); setTimeout(()=>toastEl.classList.remove("show"),1500); };

// ---- Sidebar (unchanged) ----
function setupSidebar(){
  const toggleBtn = $("menu-toggle");
  const sidebar   = $("sidebar");
  const overlay   = $("overlay");
  const closeBtn  = $("close-sidebar");
  const logout    = $("logout-link");

  const open  = ()=>{ sidebar?.classList.add("open"); overlay?.classList.add("active"); };
  const close = ()=>{ sidebar?.classList.remove("open"); overlay?.classList.remove("active"); };

  toggleBtn?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  overlay?.addEventListener("click", close);
  document.querySelectorAll("#sidebar .menu-item a").forEach(a=>{ if(!a.closest("#logout-link")) a.addEventListener("click", close); });
  logout?.addEventListener("click",(e)=>{ e.preventDefault(); auth.signOut().then(()=>location.href="login.html"); });
}

// ---- Username utils ----
const USERNAME_RE = /^[a-z0-9._-]{3,20}$/;  // adjust if you want
function sanitizeName(v){ return String(v||"").trim().toLowerCase(); }

// Keep a best-effort mapping on first load (won’t overwrite others due to rules)
async function ensureUsernameMapping(uid, uname){
  const u = sanitizeName(uname);
  if(!u) return;
  try { await db.collection("usernames").doc(u).set({ uid, username:u }, { merge:true }); } catch(_) {}
}

// Atomic change: old → new (delete old if mine, claim new if free or mine)
async function changeUsernameTx(uid, oldU, newU){
  const oldRef = oldU ? db.collection("usernames").doc(oldU) : null;
  const newRef = db.collection("usernames").doc(newU);
  const userRef= db.collection("users").doc(uid);

  return db.runTransaction(async (tx)=>{
    const newSnap = await tx.get(newRef);
    if (newSnap.exists && newSnap.data().uid !== uid) {
      throw new Error("USERNAME_TAKEN");
    }
    if (oldRef){
      const oldSnap = await tx.get(oldRef);
      if (oldSnap.exists && oldSnap.data().uid === uid) {
        tx.delete(oldRef);
      }
    }
    tx.set(newRef, { uid, username: newU });
    tx.set(userRef, { username: newU }, { merge:true });
  });
}

// ---- App ----
auth.onAuthStateChanged(async (user)=>{
  if(!user) { location.href="login.html"; return; }
  setupSidebar();

  // Identity header
  $("uid")?.textContent = user.uid;
  $("displayName")?.textContent = (user.email||"").split("@")[0] || "user";

  const uref = db.collection("users").doc(user.uid);

  // Seed (merge so nothing gets wiped)
  await uref.set({
    username: (user.email||"").split("@")[0] || "user",
    about: "",
    cards: [],
    mission: Array(15).fill(false),
    points: 0,
    quizCount: 0,
    quizStreak: 0,
    quizLastYmd: null
  }, { merge:true });

  // Live listener keeps UI in sync (username/points/cards update instantly)
  let currentUname = "";
  uref.onSnapshot((snap)=>{
    const d = snap.exists ? (snap.data()||{}) : {};
    currentUname = sanitizeName(d.username || (user.email||"").split("@")[0] || "user");

    // Header + fields
    $("displayName") && ($("displayName").textContent = currentUname);
    $("username") && ( $("username").value = currentUname );
    $("about") && ( $("about").value = d.about || "" );
    $("points") && ( $("points").textContent = String(d.points||0) );
    $("quizCount") && ( $("quizCount").textContent = String(d.quizCount||0) );
    $("quizStreak") && ( $("quizStreak").textContent = String(d.quizStreak||0) );

    // Cards grid
    const cards = Array.isArray(d.cards) ? d.cards : [];
    $("cardsCount") && ( $("cardsCount").textContent = String(cards.length) );
    const grid = $("cardsGrid");
    if (grid){
      if (!cards.length){
        grid.innerHTML = `<div class="muted">No cards yet.</div>`;
      } else {
        grid.innerHTML = cards
          .slice().sort((a,b)=>Number(a.replace('card',''))-Number(b.replace('card','')))
          .map(cId=>{
            const n = cId.replace(/card/i,"Card ");
            return `<div class="cardItem">
                      <img src="assets/cards/${cId}.png" alt="${n}"
                           onerror="this.onerror=null;this.src='assets/cards/${cId}.jpg'">
                      <div class="muted">${n}</div>
                    </div>`;
          }).join("");
      }
    }
  });

  // Best-effort mapping for whatever username we start with
  const firstSnap = await uref.get();
  await ensureUsernameMapping(user.uid, (firstSnap.data()||{}).username);

  // Force lowercase as you type (so it “shows” exactly what will be saved)
  $("username")?.addEventListener("input", (e)=>{
    const v = sanitizeName(e.target.value);
    if (e.target.value !== v) e.target.value = v;
  });

  // Save username
  $("saveUserBtn")?.addEventListener("click", async ()=>{
    const msgEl = $("saveUserMsg");
    msgEl && (msgEl.textContent = "");
    let newName = sanitizeName($("username")?.value);
    if (!newName){ msgEl && (msgEl.textContent="Please enter a username."); return; }
    if (!USERNAME_RE.test(newName)){ msgEl && (msgEl.textContent="Use 3–20 chars: a–z, 0–9, . _ -"); return; }

    try{
      await changeUsernameTx(user.uid, currentUname, newName);
      toast("Username updated");
      // UI will refresh via onSnapshot; displayName mirrors that
    }catch(e){
      if (e?.message === "USERNAME_TAKEN") {
        msgEl && (msgEl.textContent = "That username is already taken.");
      } else {
        msgEl && (msgEl.textContent = e?.message || String(e));
      }
    }
  });

  // Save about
  $("saveAboutBtn")?.addEventListener("click", async ()=>{
    const msgEl = $("saveAboutMsg");
    msgEl && (msgEl.textContent = "");
    try{
      await uref.set({ about: ($("about")?.value||"").trim() }, { merge:true });
      toast("Saved");
    }catch(e){
      msgEl && (msgEl.textContent = e?.message || String(e));
    }
  });

  // Change password (email/password only)
  $("changePassBtn")?.addEventListener("click", async ()=>{
    const msgEl = $("passMsg");
    msgEl && (msgEl.textContent = "");
    const cur = $("curPass")?.value || "";
    const nw  = $("newPass")?.value || "";
    if (!cur || !nw){ msgEl && (msgEl.textContent="Fill both fields."); return; }
    try{
      const cred = firebase.auth.EmailAuthProvider.credential(user.email, cur);
      await user.reauthenticateWithCredential(cred);
      await user.updatePassword(nw);
      $("curPass") && ( $("curPass").value = "" );
      $("newPass") && ( $("newPass").value = "" );
      toast("Password changed");
    }catch(e){
      msgEl && (msgEl.textContent = e?.message || String(e));
    }
  });

  // Sign out
  $("signOutBtn")?.addEventListener("click", ()=> auth.signOut().then(()=>location.href="login.html"));
});

// If script loads before DOM
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", setupSidebar, { once:true })
  : setupSidebar();
</script>
