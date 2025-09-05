/* daily.js v4.1 — Board layout (match daily.css v4)
   - FAB 🎁 สร้างเสมอ
   - Modal ใช้ .ribbon + .daily-board/.cell ให้ตรง CSS
   - กดรับได้จากปุ่ม หรือคลิกช่อง "วันนี้"
   - Auto-open บน allcard.html ถ้ายังไม่ได้รับวันนี้
*/

(function () {
  // ---------- helpers ----------
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d = new Date()) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, days) => {
    const x = new Date(d);
    x.setDate(x.getDate() + days);
    return x;
  };

  // ---------- rewards plan (วน 7 วัน) ----------
  const CARD_REWARD_ID = "card30"; // การ์ด 30 ได้จากรางวัลรายวัน
  const PLAN = [
    { type: "points", amount: 2, icon: "🧠", text: "+2" },
    { type: "points", amount: 3, icon: "🧠", text: "+3" },
    { type: "card",   cardId: CARD_REWARD_ID, icon: "🃏", text: "Card 30" },
    { type: "points", amount: 2, icon: "🧠", text: "+2" },
    { type: "points", amount: 3, icon: "🧠", text: "+3" },
    { type: "points", amount: 2, icon: "🧠", text: "+2" },
    { type: "combo",  amount: 2, cardId: CARD_REWARD_ID, icon: "🎁", text: "+2 + Card 30" },
  ];

  // ---------- build shell (FAB + MODAL) ----------
  ensureModalShell();
  ensureFab();

  // export open/close
  window.openDaily  = openModal;
  window.closeDaily = closeModal;

  // ---------- firebase hook (ถ้ามี) ----------
  document.addEventListener("DOMContentLoaded", hookAuthIfReady);
  hookAuthIfReady();

  function hookAuthIfReady() {
    if (!window.firebase || !window.auth || !window.db) {
      // ไม่มี Firebase → โหมดพรีวิว (ล็อกเอาต์)
      refreshPreviewLoggedOut();
      return;
    }

    const isLanding = /\/allcard\.html$/i.test(location.pathname);
    let autoOpenedOnce = false;

    auth.onAuthStateChanged(async (user) => {
      // ให้คลิกโลโก้เปิด daily ได้
      document
        .getElementById("open-daily-from-logo")
        ?.addEventListener("click", openModal);

      if (!user) {
        refreshPreviewLoggedOut();
        return;
      }

      if (isLanding && !autoOpenedOnce) {
        autoOpenedOnce = true;
        try {
          const { claimedToday } = await readDailyState(user.uid);
          if (!claimedToday) openModal();
        } catch {}
      }
      refreshPreview();
    });
  }

  // ---------- ui shell ----------
  function ensureFab() {
    if (document.getElementById("daily-fab")) return;
    const fab = document.createElement("button");
    fab.id = "daily-fab";
    fab.title = "Daily Login Rewards";
    fab.innerHTML = '🎁<span class="sr">Daily</span>';
    document.body.appendChild(fab);
    fab.addEventListener("click", openModal);
  }

  function ensureModalShell() {
    if (document.getElementById("daily-modal")) return;
    const modal = document.createElement("div");
    modal.id = "daily-modal";
    modal.innerHTML = `
      <div class="panel">
        <button class="close-x" aria-label="Close">×</button>

        <div class="ribbon">Daily Login Rewards</div>

        <div class="daily-hero" id="daily-hero">
          <!-- today chip + icon + text will be injected -->
        </div>

        <!-- บอร์ดรางวัล -->
        <div class="daily-board" id="daily-board"></div>

        <div class="daily-note">รับได้วันละครั้ง ข้ามวันรีเซ็ตรอบใหม่</div>

        <div class="daily-actions">
          <button class="daily-btn grey" id="daily-cancel">ปิด</button>
          <button class="daily-btn red"  id="daily-claim">รับรางวัล</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    // close behaviors
    modal.addEventListener("click", (e) => {
      if (e.target.id === "daily-modal") closeModal();
    });
    modal.querySelector(".close-x").addEventListener("click", closeModal);
    modal.querySelector("#daily-cancel").addEventListener("click", closeModal);
    modal.querySelector("#daily-claim").addEventListener("click", claimReward);
  }

  function openModal() {
    const m = document.getElementById("daily-modal");
    if (!m) return;
    m.classList.add("show");
    if (window.auth?.currentUser) refreshPreview();
    else refreshPreviewLoggedOut();
  }
  function closeModal() {
    document.getElementById("daily-modal")?.classList.remove("show");
  }

  // ---------- data (firebase) ----------
  async function readDailyState(uid) {
    const ref = db.collection("users").doc(uid);
    const s = await ref.get();
    const d = s.exists ? s.data() || {} : {};
    const daily =
      d.daily && typeof d.daily === "object" ? d.daily : { last: null, streak: 0 };
    const last = daily.last || null;
    const streak = Number(daily.streak || 0);

    const today = ymd();
    const yesterday = ymd(addDays(new Date(), -1));
    const claimedToday = last === today;

    const nextStreakIfClaim = last === yesterday ? streak + 1 : 1;
    const dayIdx = ((nextStreakIfClaim - 1) % 7 + 7) % 7; // 0..6

    return { today, last, streak, claimedToday, dayIdx, nextStreakIfClaim };
  }

  // ---------- render ----------
  async function refreshPreview() {
    const user = auth.currentUser;
    if (!user) return refreshPreviewLoggedOut();

    const { claimedToday, dayIdx } = await readDailyState(user.uid);
    const r = PLAN[dayIdx];

    // hero (บนหัว)
    const hero = document.getElementById("daily-hero");
    if (hero) {
      hero.innerHTML = `
        <div class="today-chip">วันนี้</div>
        <div class="hero-icon">${r.icon}</div>
        <div class="hero-text">${r.text}</div>
        ${claimedToday ? `<div class="claimed-note">รับรางวัลวันนี้แล้ว</div>` : ``}
      `;
    }

    // board
    renderBoard(dayIdx, claimedToday, /*loggedIn*/ true);

    // ปุ่ม
    const btn = document.getElementById("daily-claim");
    if (btn) btn.disabled = claimedToday;
  }

  function refreshPreviewLoggedOut() {
    const hero = document.getElementById("daily-hero");
    if (hero) {
      const r = PLAN[0];
      hero.innerHTML = `
        <div class="today-chip">ล็อกอินเพื่อรับ</div>
        <div class="hero-icon">🔒</div>
        <div class="hero-text">${r.text}</div>`;
    }
    renderBoard(0, false, /*loggedIn*/ false);
    const btn = document.getElementById("daily-claim");
    if (btn) btn.disabled = true;
  }

  function renderBoard(dayIdx, claimedToday, loggedIn) {
    const board = document.getElementById("daily-board");
    if (!board) return;

    board.innerHTML = "";
    for (let i = 0; i < 7; i++) {
      const ri = PLAN[i];
      const cell = document.createElement("div");
      cell.className = "cell";

      // state classes
      if (loggedIn) {
        if (i < dayIdx) cell.classList.add("is-claimed");
        if (i === dayIdx) cell.classList.add("is-today");
      }

      // html
      cell.innerHTML = `
        <span class="day-pill">DAY ${i + 1}</span>
        <div class="cell-icon">${i < dayIdx ? "✅" : ri.icon}</div>
        <div class="cell-text">${i < dayIdx ? "รับแล้ว" : ri.text}</div>
        <span class="stamp">CLAIMED</span>
      `;

      // คลิกช่องของ "วันนี้" เพื่อรับ (เฉพาะล็อกอินและยังไม่รับวันนี้)
      if (loggedIn && i === dayIdx && !claimedToday) {
        cell.style.cursor = "pointer";
        cell.addEventListener("click", claimReward, { once: true });
      }

      board.appendChild(cell);
    }
  }

  // ---------- claim ----------
  async function claimReward() {
    const user = auth.currentUser;
    if (!user) {
      toast("โปรดล็อกอินก่อน");
      return;
    }
    const uref = db.collection("users").doc(user.uid);

    try {
      const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(uref);
        const data = snap.exists ? snap.data() || {} : {};
        const daily =
          data.daily && typeof data.daily === "object"
            ? data.daily
            : { last: null, streak: 0 };

        const last = daily.last || null;
        const streak = Number(daily.streak || 0);

        const today = ymd();
        const yesterday = ymd(addDays(new Date(), -1));
        if (last === today) return { already: true };

        const nextStreak = last === yesterday ? streak + 1 : 1;
        const idx = ((nextStreak - 1) % 7 + 7) % 7;
        const reward = PLAN[idx];

        const upd = { daily: { last: today, streak: nextStreak } };
        if (reward.type === "points") {
          upd.points = firebase.firestore.FieldValue.increment(reward.amount);
        } else if (reward.type === "card") {
          upd.cards = firebase.firestore.FieldValue.arrayUnion(reward.cardId);
        } else {
          upd.points = firebase.firestore.FieldValue.increment(reward.amount);
          upd.cards = firebase.firestore.FieldValue.arrayUnion(reward.cardId);
        }

        tx.set(uref, upd, { merge: true });
        return { already: false, reward };
      });

      if (result.already) {
        toast("วันนี้รับแล้ว");
      } else {
        const r = result.reward;
        if (r.type === "points")      toast(`+${r.amount} Brain points 🎉`);
        else if (r.type === "card")   toast(`ได้ Card 30 🎉`);
        else                          toast(`+${r.amount} Brain points + Card 30 🎉`);
      }

      await refreshPreview();
      setTimeout(() => closeModal(), 700);
    } catch (e) {
      console.error(e);
      toast("รับรางวัลไม่สำเร็จ ลองอีกครั้ง");
    }
  }

  // ---------- toast ----------
  function toast(t) {
    let el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      Object.assign(el.style, {
        position: "fixed",
        left: "50%",
        bottom: "18px",
        transform: "translateX(-50%)",
        background: "#333",
        color: "#fff",
        padding: "10px 14px",
        borderRadius: "10px",
        zIndex: "6000",
        opacity: "0",
        transition: "opacity .2s",
      });
      document.body.appendChild(el);
    }
    el.textContent = t;
    requestAnimationFrame(() => (el.style.opacity = "1"));
    setTimeout(() => (el.style.opacity = "0"), 1600);
  }
})();
