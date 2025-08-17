// feedback.js — persistent progress + auto-reconcile flags + single-claim reward

const auth = firebase.auth();
const db   = firebase.firestore();

const $ = (id) => document.getElementById(id);

// ===== Sidebar (unchanged) =====
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

  // Keep createdAt on first write; update updatedAt afterwards
  const prev = await ref.get();
  if (prev.exists){
    await ref.update({ stars: starsChosen, message, updatedAt: now });
  } else {
    await ref.set({ stars: starsChosen, message, createdAt: now, updatedAt: now });
  }

  // Use update() with dotted path so flags persist correctly
  await db.collection("users").doc(uid).update({
    "flags.feedbackDone": true
  }).catch(async (e)=>{
    if (String(e).includes("NOT_FOUND")) {
      await db.collection("users").doc(uid).set({
        flags: { feedbackDone:true, befastDone:false, feedbackAwardGiven:false },
        points: 0, cards: []
      }, { merge:true });
    } else { throw e; }
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

  const prev = await ref.get();
  if (prev.exists){
    await ref.update({ answerText, updatedAt: now });
  } else {
    await ref.set({ answerText, createdAt: now, updatedAt: now });
  }

  await db.collection("users").doc(uid).update({
    "flags.befastDone": true
  }).catch(async (e)=>{
    if (String(e).includes("NOT_FOUND")) {
      await db.collection("users").doc(uid).set({
        flags: { feedbackDone:false, befastDone:true, feedbackAwardGiven:false },
        points: 0, cards: []
      }, { merge:true });
    } else { throw e; }
  });

  flags.befastDone = true;
  updateProgress();
  showModal("✅ Thank you for sharing your knowledge about stroke/BEFAST.");
}

// ===== Reconcile on load (AUTO-PERSIST PROGRESS) =====
// If user already has feedbacks/{uid} or strokeAnswers/{uid},
// but flags are false, flip them to true so progress survives reloads.
async function reconcileFlags(uid){
  const [fbSnap, ansSnap, userSnap] = await Promise.all([
    db.collection("feedbacks").doc(uid).get(),
    db.collection("strokeAnswers").doc(uid).get(),
    db.collection("users").doc(uid).get()
  ]);

  const haveFb  = fbSnap.exists;
  const haveAns = ansSnap.exists;

  const currentFlags = (userSnap.exists && userSnap.data().flags) ? userSnap.data().flags : {};
  const wantFeedbackDone = !!haveFb;
  const wantBefastDone   = !!haveAns;

  const needUpdate =
    currentFlags.feedbackDone !== wantFeedbackDone ||
    currentFlags.befastDone   !== wantBefastDone   ||
    typeof currentFlags.feedbackAwardGiven !== "boolean";

  if (needUpdate) {
    const patch = {};
    patch["flags.feedbackDone"]      = wantFeedbackDone;
    patch["flags.befastDone"]        = wantBefastDone;
    if (typeof currentFlags.feedbackAwardGiven !== "boolean") {
      patch["flags.feedbackAwardGiven"] = false;
    }
    await db.collection("users").doc(uid).set(patch, { merge: true });
  }
}

// ===== Claim reward (transaction, one-time) =====
async function claimReward(){
  // Double-check flags derived from docs before claim
  await reconcileFlags(uid);

  let result = "noop";
  await db.runTransaction(async (tx)=>{
    const uref = db.collection("users").doc(uid);
    const usnap = await tx.get(uref);
    const data = usnap.exists ? (usnap.data() || {}) : {};
    const f = Object.assign({ feedbackDone:false, befastDone:false, feedbackAwardGiven:false }, data.flags || {});

    if (!f.feedbackDone || !f.befastDone) { result = "not-ready"; return; }
    if (f.feedbackAwardGiven) { result = "already"; return; }

    tx.update(uref, {
      points: firebase.firestore.FieldValue.increment(5),
      cards: firebase.firestore.FieldValue.arrayUnion('card25'),
      "flags.feedbackAwardGiven": true
    });

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

// ===== Initial load =====
auth.onAuthStateChanged(async (user)=>{
  if (!user) { location.href = "login.html?next=feedback.html"; return; }
  uid = user.uid;
  setupSidebar();

  const uref = db.collection("users").doc(uid);

  // Ensure minimal doc exists (don’t overwrite existing content)
  const usnap = await uref.get();
  if (!usnap.exists) {
    await uref.set({
      username: (user.email||"").split("@")[0] || "user",
      points: 0,
      cards: [],
      flags: { feedbackDone:false, befastDone:false, feedbackAwardGiven:false }
    }, { merge: true });
  }

  // AUTO-REPAIR flags from existing docs so progress persists across reloads
  await reconcileFlags(uid);

  // Live flags listener = progress keeps in sync
  uref.onSnapshot((snap)=>{
    const data = snap.exists ? (snap.data() || {}) : {};
    flags = Object.assign({ feedbackDone:false, befastDone:false, feedbackAwardGiven:false }, data.flags || {});
    updateProgress();
  });

  // Prefill stars/feedback if present
  try {
    const fb = await db.collection("feedbacks").doc(uid).get();
    if (fb.exists) {
      const d = fb.data();
      starsChosen = Number(d.stars || 0);
      if (starsChosen) paintStars(starsChosen);
      $("feedbackText").value = d.message || "";
    }
  } catch {}

  // Prefill BEFAST if present
  try {
    const ans = await db.collection("strokeAnswers").doc(uid).get();
    if (ans.exists) $("beFastText").value = ans.data().answerText || "";
  } catch {}

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
