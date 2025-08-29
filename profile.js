// profile.js (Thai UI)
const auth = firebase.auth();
const db   = firebase.firestore();

/* ---------- Sidebar (init ASAP) ---------- */
function setupSidebar() {
  const toggleBtn = document.getElementById("menu-toggle");
  const sidebar   = document.getElementById("sidebar");
  const overlay   = document.getElementById("overlay");
  const closeBtn  = document.getElementById("close-sidebar");
  const logout    = document.getElementById("logout-link");

  const open  = () => { sidebar?.classList.add("open");  overlay?.classList.add("active"); };
  const close = () => { sidebar?.classList.remove("open"); overlay?.classList.remove("active"); };

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
document.addEventListener("DOMContentLoaded", setupSidebar);

/* ---------- Helpers ---------- */
const $ = (id) => document.getElementById(id);
const toastEl = $("toast");
function toast(t){
  if (toastEl){
    toastEl.textContent = t;
    toastEl.classList.add("show");
    setTimeout(()=>toastEl.classList.remove("show"), 1600);
  } else {
    alert(t);
  }
}

async function ensureUsernameMapping(uid, uname){
  const u = (uname||"").trim().toLowerCase();
  if (!u) return;
  try { await db.collection("usernames").doc(u).set({ uid, username: u }, { merge: true }); } catch {}
}

async function renameUsernameMapping(uid, oldU, newU){
  const oldu = (oldU||"").trim().toLowerCase();
  const newu = (newU||"").trim().toLowerCase();
  if (!newu) throw new Error("ต้องระบุชื่อผู้ใช้");
  if (oldu === newu) return;

  if (oldu){
    try {
      const snap = await db.collection("usernames").doc(oldu).get();
      if (snap.exists && snap.data().uid === uid){
        await db.collection("usernames").doc(oldu).delete();
      }
    } catch {}
  }
  await db.collection("usernames").doc(newu).set({ uid, username: newu });
}

/* ---------- App ---------- */
auth.onAuthStateChanged(async (user)=>{
  if (!user){ location.href="login.html"; return; }

  // Identity header
  $("uid")?.textContent         = user.uid;
  $("displayName")?.textContent = (user.email||"").split("@")[0] || "user";

  const docRef = db.collection("users").doc(user.uid);

  // Seed / ensure fields exist (merge so nothing is lost)
  await docRef.set({
    username: (user.email||"").split("@")[0],
    cards: [],
    mission: Array(15).fill(false),
    points: 0,
    quizCount: 0,
    quizStreak: 0,
    quizLastYmd: null
  }, { merge: true });

  // Load snapshot
  const snap = await docRef.get();
  const data = snap.data() || {};
  let currentUname = (data.username || (user.email||"").split("@")[0] || "").toLowerCase();

  if ($("username")) $("username").value = currentUname;
  if ($("about"))    $("about").value    = data.about || "";
  $("points")?.textContent     = String(data.points || 0);
  $("quizCount")?.textContent  = String(data.quizCount || 0);
  $("quizStreak")?.textContent = String(data.quizStreak || 0);

  await ensureUsernameMapping(user.uid, currentUname);

  // Cards preview
  const cards = Array.isArray(data.cards) ? data.cards : [];
  $("cardsCount")?.textContent = String(cards.length);
  const grid = $("cardsGrid");
  if (grid){
    grid.innerHTML = cards.length
      ? cards.map(cId=>{
          const label = cId.replace(/card/i, "การ์ด ");
          return `
            <div class="cardItem">
              <img src="assets/cards/${cId}.png"
                   onerror="this.onerror=null;this.src='assets/cards/${cId}.jpg'">
              <div class="muted">${label}</div>
            </div>`;
        }).join("")
      : `<div class="muted">ยังไม่มีการ์ด</div>`;
  }

  // Save username
  $("saveUserBtn")?.addEventListener("click", async ()=>{
    const newName = ($("username")?.value || "").trim().toLowerCase();
    if ($("saveUserMsg")) $("saveUserMsg").textContent = "";
    if (!newName){ $("saveUserMsg")?.textContent = "กรุณากรอกชื่อผู้ใช้"; return; }

    try{
      await renameUsernameMapping(user.uid, currentUname, newName);
      await docRef.set({ username: newName }, { merge: true });
      $("displayName")?.textContent = newName;
      currentUname = newName; // keep in sync
      toast("อัปเดตชื่อผู้ใช้แล้ว");
    }catch(e){
      $("saveUserMsg")?.textContent = e.message || String(e);
    }
  });

  // Save about
  $("saveAboutBtn")?.addEventListener("click", async ()=>{
    const about = ($("about")?.value || "").trim();
    if ($("saveAboutMsg")) $("saveAboutMsg").textContent = "";
    try{
      await docRef.set({ about }, { merge: true });
      toast("บันทึกแล้ว");
    }catch(e){
      $("saveAboutMsg")?.textContent = e.message || String(e);
    }
  });

  // Change password
  $("changePassBtn")?.addEventListener("click", async ()=>{
    const cur = $("curPass")?.value;
    const nw  = $("newPass")?.value;
    if ($("passMsg")) $("passMsg").textContent = "";
    if (!cur || !nw){ $("passMsg")?.textContent = "กรุณากรอกให้ครบทั้งสองช่อง"; return; }

    try{
      const cred = firebase.auth.EmailAuthProvider.credential(user.email, cur);
      await user.reauthenticateWithCredential(cred);
      await user.updatePassword(nw);
      if ($("curPass")) $("curPass").value = "";
      if ($("newPass")) $("newPass").value = "";
      toast("เปลี่ยนรหัสผ่านแล้ว");
    }catch(e){
      $("passMsg")?.textContent = e.message || String(e);
    }
  });

  // Sign out
  $("signOutBtn")?.addEventListener("click", ()=> auth.signOut().then(()=>location.href="login.html"));
});
