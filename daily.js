<script>
// daily.js — Typical 7-Day Daily Login Reward
// - Tracks consecutive days with Firestore { daily: { last, streak } } under /users/{uid}
// - “Dark green” claimed state via .is-claimed class (styled in your daily.css)
// - Shows green checks for already-claimed days in this 7-day cycle
// - Highlights today's cell; click it (or the main button) to claim
// - Auto-opens on allcard.html if not yet claimed today

(function () {
  // ---------- Small helpers ----------
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d = new Date()) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, days) => { const x = new Date(d); x.setDate(x.getDate() + days); return x; };
  const isLanding = /\/allcard\.html$/i.test(location.pathname);

  // ---------- Reward plan (7-day loop) ----------
  // NOTE: you said later you’ll extend to 30 days; this structure will scale.
  const CARD_REWARD_ID = "card30"; // change when needed
  const PLAN = [
    { type: "points", amount: 2, icon: "🧠", text: "+2" },
    { type: "points", amount: 3, icon: "🧠", text: "+3" },
    { type: "card",   cardId: CARD_REWARD_ID, icon: "🎴", text: "Card 30" },
    { type: "points", amount: 2, icon: "🧠", text: "+2" },
    { type: "points", amount: 3, icon: "🧠", text: "+3" },
    { type: "points", amount: 2, icon: "🧠", text: "+2" },
    { type: "combo",  amount: 2, cardId: CARD_REWARD_ID, icon: "🎁", text: "+2 + Card 30" },
  ];

  // ---------- Build UI shell immediately ----------
  ensureModalShell();
  ensureFab();

  // expose open/close to other UI (logo, etc.)
  window.openDaily = openModal;
  window.closeDaily = closeModal;

  // Hook Firebase when available
  document.addEventListener("DOMContentLoaded", hookAuthIfReady);
  hookAuthIfReady();

  function hookAuthIfReady() {
    if (!window.firebase || !window.auth || !window.db) {
      // No Firebase yet → just show a “logged out” preview
      refreshPreviewLoggedOut();
      return;
    }

    let autoOpenedOnce = false;
    auth.onAuthStateChanged(async (user) => {
      // Logo can open daily any time
      document.getElementById("open-daily-from-logo")?.addEventListener("click", openModal);

      if (!user) {
        refreshPreviewLoggedOut();
        return;
      }

      // Signed-in → fetch & render with real data
      try {
        const state = await readDailyState(user.uid);

        // Auto-open on the hub (allcard.html) if not claimed yet
        if (isLanding && !autoOpenedOnce) {
          autoOpenedOnce = true;
          if (!state.claimedToday) openModal();
        }

        refreshPreview(state);
      } catch (e) {
        console.error(e);
      }
    });
  }

  // ---------- UI shell ----------
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

        <div class="daily-hero" id="daily-hero"></div>

        <div class="board-wrap">
          <div class="daily-board" id="daily-board"></div>
        </div>

        <div class="daily-note">รับได้วันละครั้ง ข้ามวันรีเซ็ตรอบใหม่</div>

        <div class="daily-actions">
          <button class="daily-btn grey" id="daily-cancel">ปิด</button>
          <button class="daily-btn red"  id="daily-claim">รับรางวัล</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    // close behaviors
    modal.addEventListener("click", (e) => { if (e.target.id === "daily-modal") closeModal(); });
    modal.querySelector(".close-x").addEventListener("click", closeModal);
    modal.querySelector("#daily-cancel").addEventListener("click", closeModal);
    modal.querySelector("#daily-claim").addEventListener("click", onClaimButton);
  }

  function openModal() {
    const m = document.getElementById("daily-modal");
    if (!m) return;
    m.classList.add("show");

    if (window.auth?.currentUser) {
      readDailyState(auth.currentUser.uid).then(refreshPreview).catch(()=>{});
    } else {
      refreshPreviewLoggedOut();
    }
  }
  function closeModal() {
    document.getElementById("daily-modal")?.classList.remove("show");
  }

  // ---------- Firestore state ----------
  // Schema stored under /users/{uid}  → { daily: { last: 'YYYY-MM-DD', streak: Number } }
  async function readDailyState(uid) {
    const ref = db.collection("users").doc(uid);
    const s = await ref.get();
    const data = s.exists ? (s.data() || {}) : {};
    const daily = (data.daily && typeof data.daily === "object") ? data.daily : { last: null, streak: 0 };

    const last = daily.last || null;            // last claimed date string
    const streak = Number(daily.streak || 0);   // total consecutive claimed days (not capped at 7)
    const today = ymd();
    const yesterday = ymd(addDays(new Date(), -1));

    const claimedToday = (last === today);

    // Streak logic:
    // - If last === yesterday → still consecutive
    // - Else if last === today → already claimed today
    // - Else → broken; next claim resets to day 1
    const isConsecutive = (last === yesterday);

    // For rendering BEFORE claim:
    // Which day in this 7-day cycle is “today to claim”?
    // If consecutive → next claim would be streak+1
    // If reset → next claim is day 1
    const nextStreakIfClaim = claimedToday ? streak : (isConsecutive ? streak + 1 : 1);
    const dayToClaimIndex0 = ((nextStreakIfClaim - 1) % 7); // 0..6 for UI grid

    // How many days in this cycle are already claimed?
    // If claimedToday → include today in claimed
    // Else → only previous days in the current 7-day window
    const claimedCountInCycle = claimedToday
      ? (dayToClaimIndex0 + 1)   // claimed up to & including today in cycle
      : (isConsecutive ? dayToClaimIndex0 : 0); // claimed up to yesterday in cycle OR none if reset

    return {
      last,
      streak,               // running total
      claimedToday,
      dayToClaimIndex0,     // 0..6
      claimedCountInCycle,  // 0..7 (how many to paint as claimed)
      isConsecutive,
      today
    };
  }

  // ---------- Render ----------
  function refreshPreview(state) {
    const { claimedToday, dayToClaimIndex0, claimedCountInCycle } = state;
    const planForToday = PLAN[dayToClaimIndex0];

    // HERO
    const hero = document.getElementById("daily-hero");
    if (hero) {
      hero.innerHTML = `
        <div class="today-chip">${claimedToday ? "วันนี้รับแล้ว" : "วันนี้"}</div>
        <div class="hero-icon">${claimedToday ? "✅" : planForToday.icon}</div>
        <div class="hero-text">${claimedToday ? "รับแล้ว" : planForToday.text}</div>
        ${claimedToday ? `<div class="claimed-note">รับรางวัลวันนี้แล้ว</div>` : ``}
      `;
    }

    // BOARD
    renderBoard(dayToClaimIndex0, claimedCountInCycle, claimedToday);

    // BUTTON
    const btn = document.getElementById("daily-claim");
    if (btn) btn.disabled = !!claimedToday;
  }

  function refreshPreviewLoggedOut() {
    const hero = document.getElementById("daily-hero");
    if (hero) {
      hero.innerHTML = `
        <div class="today-chip">ล็อกอินเพื่อรับ</div>
        <div class="hero-icon">🔒</div>
        <div class="hero-text">${PLAN[0].text}</div>
      `;
    }
    renderBoard(0, 0, false);
    const btn = document.getElementById("daily-claim");
    if (btn) btn.disabled = true;
  }

  function renderBoard(dayToClaimIndex0, claimedCountInCycle, claimedToday) {
    const board = document.getElementById("daily-board");
    if (!board) return;
    board.innerHTML = "";

    for (let i = 0; i < 7; i++) {
      const r = PLAN[i];
      const cell = document.createElement("div");
      cell.className = "cell";

      // Claimed days in this cycle: 0 .. (claimedCountInCycle-1)
      if (i < claimedCountInCycle) {
        cell.classList.add("is-claimed");
      }

      // Today's cell highlight if not yet claimed
      if (!claimedToday && i === dayToClaimIndex0 && window.auth?.currentUser) {
        cell.classList.add("is-today");
        cell.style.cursor = "pointer";
        cell.title = "แตะเพื่อรับรางวัลวันนี้";
        cell.addEventListener("click", onClaimButton, { once: true });
      }

      const isClaimed = i < claimedCountInCycle;
      cell.innerHTML = `
        <span class="day-pill">DAY ${i + 1}</span>
        <div class="cell-icon">${isClaimed ? "✅" : r.icon}</div>
        <div class="cell-text">${isClaimed ? "รับแล้ว" : r.text}</div>
        <span class="stamp">CLAIMED</span>
      `;

      board.appendChild(cell);
    }
  }

  // ---------- Claim handlers ----------
  async function onClaimButton() {
    if (!window.auth?.currentUser) { toast("โปรดล็อกอินก่อน"); return; }
    await claimReward();
    // Refresh UI after claim
    const state = await readDailyState(auth.currentUser.uid);
    refreshPreview(state);
    setTimeout(closeModal, 700);
  }

  async function claimReward() {
    const user = auth.currentUser;
    if (!user) { toast("โปรดล็อกอินก่อน"); return; }

    const uref = db.collection("users").doc(user.uid);
    try {
      const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(uref);
        const data = snap.exists ? (snap.data() || {}) : {};
        const daily = (data.daily && typeof data.daily === "object") ? data.daily : { last: null, streak: 0 };

        const last = daily.last || null;
        const streak = Number(daily.streak || 0);
        const today = ymd();
        const yesterday = ymd(addDays(new Date(), -1));

        // Already claimed today? Stop.
        if (last === today) return { already: true };

        // Compute next streak correctly
        const nextStreak = (last === yesterday) ? streak + 1 : 1;
        const idx0 = ((nextStreak - 1) % 7);  // index to pay out

        const reward = PLAN[idx0];

        // Prepare atomic update
        const upd = { daily: { last: today, streak: nextStreak } };
        if (reward.type === "points") {
          upd.points = firebase.firestore.FieldValue.increment(reward.amount);
        } else if (reward.type === "card") {
          upd.cards  = firebase.firestore.FieldValue.arrayUnion(reward.cardId);
        } else {
          upd.points = firebase.firestore.FieldValue.increment(reward.amount);
          upd.cards  = firebase.firestore.FieldValue.arrayUnion(reward.cardId);
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
    } catch (e) {
      console.error(e);
      toast("รับรางวัลไม่สำเร็จ ลองอีกครั้ง");
    }
  }

  // ---------- Toast ----------
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
</script>
