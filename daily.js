<script>
// Daily Rewards — floating button + modal (home page only)
(function(){
  // ---- Config ----
  const rewards = [
    { day:1, points:2 },
    { day:2, points:3 },
    { day:3, card:true },         // event card
    { day:4, points:2 },
    { day:5, points:3 },
    { day:6, points:2 },
    { day:7, points:2, card:true } // + event card
  ];
  const EVENT_CARD_ID = "card_event"; // add this file: assets/cards/card_event.png (or .jpg)

  // ---- Small helpers ----
  const $ = (sel, root=document)=>root.querySelector(sel);
  const el = (tag, cls)=>{ const x=document.createElement(tag); if(cls) x.className=cls; return x; };
  function ymd(d=new Date()){
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), dd=String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${dd}`;
  }
  function daysBetween(a,b){
    const p=s=>{ const [yy,mm,dd]=s.split("-").map(Number); return new Date(yy,mm-1,dd).setHours(0,0,0,0); };
    return Math.round((p(b)-p(a))/(24*3600*1000));
  }

  // ---- DOM injected (no HTML edits needed) ----
  const fab = el("button","daily-fab"); fab.title="Daily Login Rewards"; fab.textContent="🎁";
  const modal = el("div","daily-modal");
  modal.innerHTML = `
    <div class="daily-backdrop"></div>
    <div class="daily-sheet">
      <button class="daily-close" aria-label="Close">×</button>
      <div class="daily-title">Daily Login Rewards</div>
      <div class="daily-hero" id="dailyHero"></div>
      <div class="daily-grid" id="dailyGrid"></div>
      <div class="daily-actions">
        <button class="daily-btn red" id="dailyClaim">Claim Reward</button>
        <button class="daily-btn grey" id="dailyClose2">Close</button>
      </div>
      <div class="daily-msg" id="dailyMsg"></div>
    </div>`;
  document.body.appendChild(fab);
  document.body.appendChild(modal);

  const hero  = $("#dailyHero", modal);
  const grid  = $("#dailyGrid", modal);
  const msg   = $("#dailyMsg",  modal);
  const btn   = $("#dailyClaim",modal);
  const xBtn  = $(".daily-close",modal);
  const close2= $("#dailyClose2",modal);

  const auth = firebase.auth();
  const db   = firebase.firestore();
  let user   = null;

  function renderUI(day, claimedToday){
    // hero
    const r = rewards[day-1];
    hero.innerHTML = r.card
      ? `<div class="daily-card">EVENT</div><div><div class="points">+1</div><div class="small">Event Card</div></div>`
      : `<div class="points">+${r.points} 🧠</div><div class="small">Brain points</div>`;

    // 7-day strip
    grid.innerHTML = rewards.map(rr=>{
      let cls="";
      if (rr.day < day) cls="done"; else if (rr.day===day && !claimedToday) cls="active";
      const label = rr.card ? "+1 Event" : `+${rr.points} pts`;
      return `<div class="daily-day ${cls}">Day ${rr.day}<span class="small">${label}</span></div>`;
    }).join("");

    // button state + msg
    btn.disabled = !!claimedToday;
    msg.textContent = claimedToday ? "Already claimed today." : "";
  }

  function open(){ modal.classList.add("show"); }
  function close(){ modal.classList.remove("show"); }
  xBtn.addEventListener("click", close);
  close2.addEventListener("click", close);
  fab.addEventListener("click", open);

  // Track "first page after login" per day & user (to auto-open once)
  function firstPageKey(uid){ return `daily-shown:${uid}:${ymd()}`; }

  // Compute current claimable day (1..7) and whether already claimed today
  function computeDay(uDaily){
    const today = ymd();
    const last  = uDaily?.last || null;
    let streak  = Number(uDaily?.streak || 0); // 0..7 (we keep 1..7 active)
    let claimedToday = false;

    if (!last){
      streak = 1;
    } else {
      const gap = daysBetween(last, today);
      if (gap <= 0){ // same day
        claimedToday = true;
        streak = Math.min(streak||1,7);
      } else if (gap === 1){
        streak = (streak % 7) + 1;
      } else {
        streak = 1; // missed → reset
      }
    }
    return { day: streak, claimedToday };
  }

  async function claim(uid){
    const uref = db.collection("users").doc(uid);
    await db.runTransaction(async (tx)=>{
      const snap = await tx.get(uref);
      const u = snap.exists ? (snap.data()||{}) : {};
      const today = ymd();
      const { day, claimedToday } = computeDay(u.daily);
      if (claimedToday) throw new Error("Already claimed today");

      const reward = rewards[day-1];
      const updates = {
        daily: { last: today, streak: day }
      };
      if (reward.points){
        updates.points = firebase.firestore.FieldValue.increment(reward.points);
      }
      if (reward.card){
        updates.cards  = firebase.firestore.FieldValue.arrayUnion(EVENT_CARD_ID);
      }
      tx.set(uref, updates, { merge:true });
    });
  }

  // Start
  auth.onAuthStateChanged(async (u)=>{
    if(!u) return; user = u;
    const uref = db.collection("users").doc(u.uid);

    // Seed doc safely so other pages keep working
    await uref.set({
      points: firebase.firestore.FieldValue.increment(0),
      cards: [],
      username: (u.email||"").split("@")[0] || "user"
    }, { merge:true });

    const s = await uref.get();
    const d = s.data()||{};
    const { day, claimedToday } = computeDay(d.daily);

    renderUI(day, claimedToday);

    // Auto-open once on first page after login (per day)
    const key = firstPageKey(u.uid);
    if (!sessionStorage.getItem(key)){
      open();
      sessionStorage.setItem(key, "1");
    }

    btn.addEventListener("click", async ()=>{
      btn.disabled = true; msg.textContent = "Processing…";
      try{
        await claim(u.uid);
        msg.textContent = "Reward claimed!";
        // Recompute & repaint (now it's claimed)
        const s2 = await uref.get();
        const d2 = s2.data()||{};
        const st = computeDay(d2.daily);
        renderUI(st.day, true);
        // (Optional) close after short delay
        setTimeout(close, 700);
      }catch(e){
        msg.textContent = e?.message || String(e);
        btn.disabled = true;
      }
    });
  });
})();
</script>
