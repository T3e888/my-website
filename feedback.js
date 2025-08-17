// feedback.js — rating + BEFAST + claim reward (points + card25)

const auth = firebase.auth();
const db   = firebase.firestore();

const $ = (id) => document.getElementById(id);
const show = (el) => el.classList.remove('hidden');
const hide = (el) => el.classList.add('hidden');

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

function showModal(msg, cb){
  const modal = $("modal");
  modal.innerHTML = `<div class="modal-content">${msg}<br><button class="ok">OK</button></div>`;
  modal.classList.add("active");
  modal.querySelector(".ok").onclick = ()=>{ modal.classList.remove("active"); cb?.(); };
}

/* ---------- Star bar (1..5) ---------- */
let currentStars = 0;
function paintStars(n){
  const bar = $("starBar");
  bar.innerHTML = "";
  for (let i=1;i<=5;i++){
    const s = document.createElement("span");
    s.className = "star" + (i<=n ? " on" : "");
    s.textContent = "★";
    s.dataset.value = String(i);
    s.onclick = ()=>{ currentStars = i; paintStars(currentStars); };
    bar.appendChild(s);
  }
}

/* ---------- Load state ---------- */
async function loadState(uid){
  const userRef = db.collection("users").doc(uid);
  const [userSnap, fbSnap, ansSnap] = await Promise.all([
    userRef.get(),
    db.collection("feedbacks").doc(uid).get(),
    db.collection("strokeAnswers").doc(uid).get()
  ]);

  // Ensure user doc exists (do not touch existing cards/points)
  if (!userSnap.exists){
    await userRef.set({
      username: (auth.currentUser?.email || "").split("@")[0] || "user",
      points: 0,
      cards: [],
      flags: { feedbackDone:false, befastDone:false, feedbackAwardGiven:false }
    });
  }

  let flags = (userSnap.exists && userSnap.data().flags) ? userSnap.data().flags : {};
  flags = {
    feedbackDone: !!flags.feedbackDone,
    befastDone: !!flags.befastDone,
    feedbackAwardGiven: !!flags.feedbackAwardGiven
  };

  // If docs exist, prefill UI
  if (fbSnap.exists){
    const v = fbSnap.data();
    currentStars = Number(v.stars) || 0;
    $("feedbackText").value = v.message || "";
  } else {
    currentStars = 0;
    $("feedbackText").value = "";
  }
  paintStars(currentStars);

  if (ansSnap.exists){
    const v = ansSnap.data();
    $("beFastText").value = v.answerText || "";
  } else {
    $("beFastText").value = "";
  }

  renderProgress(flags);
}

/* ---------- Progress + Claim button ---------- */
function renderProgress(flags){
  const note = $("progressNote");
  const claim = $("claimRewardBtn");
  note.innerHTML = `
    Feedback: ${flags.feedbackDone ? "✔" : "✖"} &nbsp; | &nbsp;
    Knowledge: ${flags.befastDone ? "✔" : "✖"} &nbsp; | &nbsp;
    Reward: ${flags.feedbackAwardGiven ? "CLAIMED" : "NOT CLAIMED"}
  `;
  if (flags.feedbackDone && flags.befastDone && !flags.feedbackAwardGiven){
    show(claim);
  } else {
    hide(claim);
  }
}

/* ---------- Save feedback ---------- */
async function saveFeedback(uid){
  const stars = currentStars;
  const msg   = ($("feedbackText").value || "").trim();
  if (!(stars>=1 && stars<=5)){ showModal("Please select a rating from 1 to 5 stars."); return; }
  if (!msg){ showModal("Please write your feedback message."); return; }

  // Transaction so createdAt is set once, updatedAt always
  await db.runTransaction(async (tx)=>{
    const ref = db.collection("feedbacks").doc(uid);
    const us  = await tx.get(ref);
    if (us.exists){
      tx.set(ref, {
        stars,
        message: msg,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        // keep createdAt as is
      }, { merge: true });
    } else {
      tx.set(ref, {
        stars,
        message: msg,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  });

  // Mark flag on user
  await db.collection("users").doc(uid).set({
    flags: { feedbackDone: true }
  }, { merge: true });

  showModal("✅ Thank you for your feedback! Saved successfully.");
  // Refresh progress
  const us = await db.collection("users").doc(uid).get();
  renderProgress(us.data().flags || {});
}

/* ---------- Save BEFAST knowledge ---------- */
async function saveBeFast(uid){
  const text = ($("beFastText").value || "").trim();
  if (!text){ showModal("Please write what you know about stroke/BEFAST."); return; }

  await db.runTransaction(async (tx)=>{
    const ref = db.collection("strokeAnswers").doc(uid);
    const us  = await tx.get(ref);
    if (us.exists){
      tx.set(ref, {
        answerText: text,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } else {
      tx.set(ref, {
        answerText: text,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  });

  // Mark flag on user
  await db.collection("users").doc(uid).set({
    flags: { befastDone: true }
  }, { merge: true });

  showModal("✅ Thank you for sharing your knowledge about stroke/BEFAST.");
  const us = await db.collection("users").doc(uid).get();
  renderProgress(us.data().flags || {});
}

/* ---------- Claim reward (transaction) ---------- */
async function claimReward(uid){
  try {
    await db.runTransaction(async (tx)=>{
      const uref = db.collection("users").doc(uid);
      const us   = await tx.get(uref);
      if (!us.exists) throw new Error("User doc missing");
      const data  = us.data() || {};
      const flags = data.flags || {};
      const doneFeedback = !!flags.feedbackDone;
      const doneBeFast   = !!flags.befastDone;
      const already      = !!flags.feedbackAwardGiven;
      if (!doneFeedback || !doneBeFast) throw new Error("Complete both tasks first.");
      if (already) throw new Error("Reward already claimed.");

      const points = Number(data.points || 0) + 5;

      tx.set(uref, {
        points,
        flags: { feedbackAwardGiven: true },
        cards: firebase.firestore.FieldValue.arrayUnion("card25")
      }, { merge: true });
    });

    showModal("🎉 Congratulations! You earned +5 points and Event Card #25.", ()=>{
      // optional: go see the card
      // location.href = "card.html";
    });

    // refresh progress
    const us = await db.collection("users").doc(uid).get();
    renderProgress(us.data().flags || {});
  } catch (e){
    showModal("❌ " + (e?.message || e));
  }
}

/* ---------- Start ---------- */
auth.onAuthStateChanged(async (user)=>{
  if (!user){ location.href = "login.html"; return; }
  setupSidebar();
  paintStars(0);

  // wire buttons
  $("saveFeedbackBtn").onclick = ()=> saveFeedback(user.uid);
  $("saveBeFastBtn").onclick   = ()=> saveBeFast(user.uid);
  $("claimRewardBtn").onclick  = ()=> claimReward(user.uid);

  loadState(user.uid);
});
