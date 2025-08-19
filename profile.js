// profile.js (Thai UI)
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

// maintains /usernames mapping safely
async function ensureUsernameMapping(uid, uname) {
  if (!uname) return;
  uname = uname.trim().toLowerCase();
  if (!uname) return;
  try {
    await db.collection("usernames").doc(uname).set({ uid, username: uname }, { merge: true });
  } catch (e) {
    // ignore if taken by someone else; UI handles on rename
  }
}

async function renameUsernameMapping(uid, oldU, newU) {
  oldU = (oldU||"").trim().toLowerCase();
  newU = (newU||"").trim().toLowerCase();
  if (!newU) throw new Error("ต้องระบุชื่อผู้ใช้");
  if (oldU === newU) return;

  if (oldU) {
    try {
      const oldSnap = await db.collection("usernames").doc(oldU).get();
      if (oldSnap.exists && oldSnap.data().uid === uid) {
        await db.collection("usernames").doc(oldU).delete();
      }
    } catch {}
  }

  await db.collection("usernames").doc(newU).set({ uid, username: newU });
}

// ---------- App ----------
auth.onAuthStateChanged(async (user) => {
  if (!user) { location.href = "login.html"; return; }
  setupSidebar();

  $("uid").textContent        = user.uid;
  $("email").textContent      = user.email || "(ไม่มีอีเมล)";
  $("displayName").textContent= (user.email||"").split("@")[0];

  const docRef = db.collection("users").doc(user.uid);

  // Ensure user doc exists + seed
  await docRef.set({
    username: (user.email||"").split("@")[0],
    cards: [],
    mission: Array(15).fill(false),
    points: 0
  }, { merge: true });

  // Load
  const snap = await docRef.get();
  const data = snap.data() || {};
  const currentUname = (data.username || (user.email||"").split("@")[0] || "").toLowerCase();

  $("username").value      = currentUname;
  $("about").value         = data.about || "";
  $("points").textContent  = String(data.points || 0);

  await ensureUsernameMapping(user.uid, currentUname);

  // Render cards
  const cards = Array.isArray(data.cards) ? data.cards : [];
  $("cardsCount").textContent = String(cards.length);
  const grid = $("cardsGrid");
  grid.innerHTML = cards.length
    ? cards.map(cId => {
        const img = `assets/cards/${cId}.png`;
        const label = cId.replace(/card/i,"Card ");
        return `<div class="cardItem"><img src="${img}" alt="${label}" /><div class="muted">${label}</div></div>`;
      }).join("")
    : `<div class="muted">ยังไม่มีการ์ด</div>`;

  // Save username (also update /usernames mapping)
  $("saveUserBtn").onclick = async () => {
    const newName = $("username").value.trim().toLowerCase();
    $("saveUserMsg").textContent = "";
    if (!newName) { $("saveUserMsg").textContent = "กรุณากรอกชื่อผู้ใช้"; return; }

    try {
      await renameUsernameMapping(user.uid, currentUname, newName);
      await docRef.set({ username: newName }, { merge: true });
      $("displayName").textContent = newName;
      toast("อัปเดตชื่อผู้ใช้แล้ว");
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
      toast("บันทึกแล้ว");
    } catch (e) {
      $("saveAboutMsg").textContent = e.message || String(e);
    }
  };

  // Change password (re-auth)
  $("changePassBtn").onclick = async () => {
    const cur = $("curPass").value;
    const nw  = $("newPass").value;
    $("passMsg").textContent = "";
    if (!cur || !nw) { $("passMsg").textContent = "กรุณากรอกให้ครบทั้งสองช่อง"; return; }

    try {
      const cred = firebase.auth.EmailAuthProvider.credential(user.email, cur);
      await user.reauthenticateWithCredential(cred);
      await user.updatePassword(nw);
      $("curPass").value = ""; $("newPass").value = "";
      toast("เปลี่ยนรหัสผ่านแล้ว");
    } catch (e) {
      $("passMsg").textContent = e.message || String(e);
    }
  };

  // Sign out
  $("signOutBtn").onclick = () => auth.signOut().then(()=>location.href="login.html");
});
