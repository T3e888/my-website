// feedback.js — stars + feedback + BEFAST + claim reward (card25 +5pts) — ROBUST VERSION

const auth = firebase.auth();
const db   = firebase.firestore();

const $ = (id) => document.getElementById(id);

/* ---------- Sidebar ---------- */
function setupSidebar(){
  const toggleBtn = $("menu-toggle");
  const sidebar   = $("sidebar");
  const overlay   = $("overlay");
  const closeBtn  = $("close-sidebar");
  const logout    = $("logout-link");
  const open  = ()=>{ sidebar.classList.add("open"); overlay.classList.add("active"); };
  const close = ()=>{ sidebar.classList.remove("open"); overlay.classList.remove("active"); };
  toggleBtn?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  overlay?.addEventListener("click", close);
  logout?.addEventListener("click", (e)=>{ e.preventDefault(); auth.signOut().then(()=>location.href="login.html"); });
}

/* ---------- Modal ---------- */
function showModal(html, cb) {
  const modal = $("modal");
  if (!modal) return alert(html.replace(/<[^>]+>/g,''));
  modal.innerHTML = `<div class="modal-content">${html}<br><button class="ok">OK</button></div>`;
  modal.classList.add("active");
  modal.querySelector(".ok").onclick = () => { modal.classList.remove("active"); cb?.(); };
}

/* ---------- State ---------- */
let uid = null;
let starsChosen = 0;
let flags = { feedbackDone:false, befastDone:false, feedbackAwardGiven:false };

/* ---------- UI helpers ---------- */
function paintStars(n){
  document.querySelectorAll("#starBar .star").forEach(el=>{
    const v = Number(el.dataset.v);
    if (v <= n) el.classList.remove("dim"); else el.classList.add("dim");
  });
}
function updateProgress(){
  const note = $("progressNote");
  const allDone = flags.feedbackDone && flags.befastDone;
  note.innerHTML = `
    Feedback: <b style="color:${flags.feedbackDone?'#1b5e20':'#b71c1c'}">${flags.feedbackDone?'✔':'✖'}</b>
    &nbsp;&nbsp;|&nbsp;&nbsp;
    Knowledge: <b style="color:${flags.befastDone?'#1b5e20':'#b71c1c'}">${flags.befastDone?'✔':'✖'}</b>
  `;
  const claimBtn = $("claimRewardBtn");
  if (allDone && !flags.feedbackAwardGiven) claimBtn.classList.remove("hidden");
  else claimBtn.classList.add("hidden");
}

/* ---------- Save: Feedback (BATCH) ---------- */
async function saveFeedback(){
  const message = ($("feedbackText").value || "").trim();
  if (!starsChosen || starsChosen < 1 || starsChosen > 5) { showModal("Please choose a star rating (1–5)."); return; }
  if (!message) { showModal("Please write some feedback."); return; }

  const now = firebase.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();

  const fbRef = db.collection("feedbacks").doc(uid);
  batch.set(fbRef, { stars: starsChosen, message, createdAt: now, updatedAt: now }, { merge: true });

  const userRef = db.collection("users").doc(uid);
  batch.set(userRef, { flags: { feedbackDone: true } }, { merge: true });

  await batch.commit();

  flags.feedbackDone = true;
  updateProgress();
  showModal("✅ Thank you for your feedback! Saved successfully.");
}

/* ---------- Save: BEFAST / Knowledge (BATCH) ---------- */
async function saveBeFast(){
  const answerText = ($("beFastText").value || "").trim();
  if (!answerText) { showModal("Please write what you know about stroke/BEFAST."); return; }

  const now = firebase.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();

  const ansRef = db.collection("strokeAnswers").doc(uid);
  batch.set(ansRef, { answerText, createdAt: now, updatedAt: now }, { merge: true });

  const userRef = db.collection("users").doc(uid);
  batch.set(userRef, { flags: { befastDone: true } }, { merge: true });

  await batch.commit();

  flags.befastDone = true;
  updateProgress();
  showModal("✅ Thank you for sharing your knowledge about stroke/BEFAST.");
}

/* ---------- Claim reward (Transaction, FLAG SELF-HEAL) ---------- */
async function claimReward(){
  let result = "noop";

  await db.runTransaction(async (tx)=>{
    const uref = db.collection("users").doc(uid);
    const usnap = await tx.get(uref);
    const data = usnap.exists ? (usnap.data() || {}) : {};
    const f = data.flags || {};

    if (f.feedbackAwardGiven) { result = "already"; return; }

    // check flags OR fall back to existence of the two docs
    let ready = !!(f.feedbackDone && f.befastDone);

    if (!ready) {
      const fbSnap  = await tx.get(db.collection("feedbacks").doc(uid));
      const ansSnap = await tx.get(db.collection("strokeAnswers").doc(uid));
      if (fbSnap.exists && ansSnap.exists) {
        ready = true;
        // fix flags while granting
        tx.set(uref, { flags: { feedbackDone: true, befastDone: true } }, { merge: true });
      }
    }

    if (!ready) { result = "not-ready"; return; }

    // idempotent grant
    tx.set(uref, {
      points: firebase.firestore.FieldValue.increment(5),
      cards:  firebase.firestore.FieldValue.arrayUnion('card25'),
      flags:  { feedbackAwardGiven: true }
    }, { merge: true });

    result = "claimed";
  });

  if (result === "claimed") {
    flags.feedbackAwardGiven = true;
    updateProgress();
    showModal("🎉 Congratulations! You earned <b>+5 points</b> and unlocked <b>Event Card #25</b>.");
  } else if (result === "already") {
    showModal("You have already claimed this reward.");
  } else if (result === "not-ready") {
    showModal("Please complete both Feedback and BEFAST sections first.");
  }
}

/* ---------- Initial load ---------- */
auth.onAuthStateChanged(async (user)=>{
  if (!user) { location.href = "login.html?next=feedback.html"; return; }
  uid = user.uid;
  setupSidebar();

  const uref = db.collection("users").doc(uid);

  // Create if missing (merge so we never wipe anything)
  await uref.set({
    username: (user.email||"").split("@")[0] || "user",
    points: 0,
    cards: [],
    flags: { feedbackDone:false, befastDone:false, feedbackAwardGiven:false }
  }, { merge: true });

  // Live flags (so leaving/returning page always reflects reality)
  uref.onSnapshot((snap)=>{
    const data = snap.exists ? (snap.data() || {}) : {};
    const serverFlags = Object.assign({ feedbackDone:false, befastDone:false, feedbackAwardGiven:false }, data.flags || {});
    flags = serverFlags;
    updateProgress();
  });

  // Prefill existing feedback / knowledge (for convenience)
  const fb = await db.collection("feedbacks").doc(uid).get();
  if (fb.exists) {
    const d = fb.data();
    starsChosen = Number(d.stars || 0);
    paintStars(starsChosen);
    $("feedbackText").value = d.message || "";
  }
  const ans = await db.collection("strokeAnswers").doc(uid).get();
  if (ans.exists) $("beFastText").value = ans.data().answerText || "";

  // Bind stars + buttons
  document.querySelectorAll("#starBar .star").forEach(el=>{
    el.addEventListener("click", ()=>{
      starsChosen = Number(el.dataset.v);
      paintStars(starsChosen);
    });
  });
  $("saveFeedbackBtn").addEventListener("click", saveFeedback);
  $("saveBeFastBtn").addEventListener("click", saveBeFast);
  $("claimRewardBtn").addEventListener("click", claimReward);
});
