// feedback.js — stars + feedback + BEFAST + claim reward (card25 +5pts)

const auth = firebase.auth();
const db   = firebase.firestore();

const $ = (id) => document.getElementById(id);

// Ensure auth persists across tabs/sessions
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(()=>{});

// ===== Sidebar =====
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

// ===== Modal =====
function showModal(html, cb) {
  const modal = $("modal");
  if (!modal) return;
  modal.innerHTML = `<div class="modal-content">${html}<br><button class="ok">OK</button></div>`;
  modal.classList.add("active");
  modal.querySelector(".ok").onclick = () => { modal.classList.remove("active"); cb?.(); };
}

// ===== State =====
let uid = null;
let starsChosen = 0;
let flags = { feedbackDone:false, befastDone:false, feedbackAwardGiven:false };

// ===== UI helpers =====
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

// ===== Save Feedback =====
async function saveFeedback(){
  const message = ($("feedbackText").value || "").trim();
  if (!starsChosen || starsChosen < 1 || starsChosen > 5) {
    showModal("Please choose a star rating (1–5).");
    return;
  }
  if (!message) {
    showModal("Please write some feedback.");
    return;
  }

  const ref = db.collection("feedbacks").doc(uid);
  const now = firebase.firestore.FieldValue.serverTimestamp();

  await ref.set({
    stars: starsChosen,
    message,
    createdAt: now,
    updatedAt: now
  });

  // Use update() for dot-path safety
  await db.collection("users").doc(uid).update({
    "flags.feedbackDone": true
  }).catch(async () => {
    // if user doc doesn't exist yet
    await db.collection("users").doc(uid).set({ flags: { feedbackDone: true } }, { merge: true });
  });

  flags.feedbackDone = true;
  updateProgress();
  showModal("✅ Thank you for your feedback! Saved successfully.");
}

// ===== Save BEFAST knowledge =====
async function saveBeFast(){
  const answerText = ($("beFastText").value || "").trim();
  if (!answerText) { showModal("Please write what you know about stroke/BEFAST."); return; }

  const ref = db.collection("strokeAnswers").doc(uid);
  const now = firebase.firestore.FieldValue.serverTimestamp();

  await ref.set({
    answerText,
    createdAt: now,
    updatedAt: now
  });

  await db.collection("users").doc(uid).update({
    "flags.befastDone": true
  }).catch(async () => {
    await db.collection("users").doc(uid).set({ flags: { befastDone: true } }, { merge: true });
  });

  flags.befastDone = true;
  updateProgress();
  showModal("✅ Thank you for sharing your knowledge about stroke/BEFAST.");
}

// ===== Claim reward (transaction) =====
async function claimReward(){
  let result = "noop";
  await db.runTransaction(async (tx)=>{
    const uref = db.collection("users").doc(uid);
    const usnap = await tx.get(uref);
    const data = usnap.exists ? (usnap.data() || {}) : {};
    const f = data.flags || {};

    if (f.feedbackAwardGiven) { result = "already"; return; }
    if (!(f.feedbackDone && f.befastDone)) { result = "not-ready"; return; }

    tx.set(uref, {
      points: firebase.firestore.FieldValue.increment(5),
      cards: firebase.firestore.FieldValue.arrayUnion('card25'),
      flags: {
        feedbackAwardGiven: true,
        feedbackAwardPatched: true,          // marker so other pages know it's applied
        pointsFromFeedbackApplied: true
      }
    }, { merge: true });

    result = "claimed";
  });

  if (result === "claimed") {
    flags.feedbackAwardGiven = true;
    updateProgress();
    showModal("🎉 Congratulations! You earned <b>+5 points</b> and unlocked <b>Event Card #25</b>.", () => {
      // stay here, or go to collection:
      // location.href = 'card.html';
    });
  } else if (result === "already") {
    showModal("You have already claimed this reward.");
  } else if (result === "not-ready") {
    showModal("Please complete both Feedback and BEFAST sections first.");
  }
}

// ===== Initial load =====
auth.onAuthStateChanged(async (user)=>{
  if (!user) { location.href = "login.html?next=feedback.html"; return; }
  uid = user.uid;
  setupSidebar();

  // Ensure users/{uid} exists (don't touch cards[] if doc already exists)
  const uref = db.collection("users").doc(uid);
  const usnap = await uref.get();
  if (!usnap.exists) {
    await uref.set({
      username: (user.email||"").split("@")[0] || "user",
      points: 0,
      cards: [],
      flags: { feedbackDone:false, befastDone:false, feedbackAwardGiven:false }
    }, { merge: true });
  } else {
    const data = usnap.data() || {};
    flags = Object.assign({ feedbackDone:false, befastDone:false, feedbackAwardGiven:false }, data.flags || {});
  }
  updateProgress();

  // Prefill existing feedback / answer (optional QoL)
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
