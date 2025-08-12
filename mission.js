// ====== Auth guard ======
const auth = firebase.auth();
const db   = firebase.firestore();

const LEVEL_COUNT = 10;      // keep 10 as you had
let CURRENT_POINTS = 0;

// ---- small safe-log helper so errors don't kill the UI ----
const log = (...a) => { try { console.log(...a); } catch(_){} };

// ====== Start ======
auth.onAuthStateChanged(async (user) => {
  if (!user) return location.href = "login.html";
  setupSidebar();
  try {
    await buildPath(user);
  } catch (e) {
    log("buildPath error:", e);
    toast("There was a small loading error. Try refresh (Ctrl/Cmd+Shift+R).");
  }
});

// ====== Sidebar (same behavior everywhere) ======
function setupSidebar() {
  const toggleBtn = document.getElementById("menu-toggle");
  const sidebar   = document.getElementById("sidebar");
  const overlay   = document.getElementById("overlay");
  const closeBtn  = document.getElementById("close-sidebar");
  const logout    = document.getElementById("logout-link");

  const open = () => { sidebar.classList.add("open"); overlay.classList.add("active"); };
  const close = () => { sidebar.classList.remove("open"); overlay.classList.remove("active"); };

  toggleBtn?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  overlay?.addEventListener("click", close);
  document.querySelectorAll("#sidebar .menu-item a").forEach(a=>{
    if (!a.closest("#logout-link")) a.addEventListener("click", close);
  });
  logout?.addEventListener("click", (e)=>{ e.preventDefault(); auth.signOut().then(()=>location.href="login.html"); });
}

// ====== Questions (keep your original 10 for now) ======
const BASE_QUESTIONS = [
  { q: "Which is an early sign of stroke?", opts: ["Face drooping, slurred speech", "Stomach pain", "Back pain", "Rash"], a: 0 },
  { q: "Emergency number in Thailand?",    opts: ["1669", "1234", "110", "999"], a: 0 },
  { q: "First step when someone collapses?", opts:["Call 1669", "Give water", "Lift legs", "Shake hard"], a:0 },
  { q: "Best way to prevent stroke?",      opts: ["No smoking", "Control blood pressure", "Exercise", "All of the above"], a:3 },
  { q: "FAST test: F stands for…",         opts: ["Face", "Feet", "Food", "Finger"], a:0 },
  { q: "FAST test: A stands for…",         opts: ["Arms", "Air", "Age", "Alert"], a:0 },
  { q: "FAST test: S stands for…",         opts: ["Speech", "Sugar", "Sleep", "Sit"], a:0 },
  { q: "FAST test: T stands for…",         opts: ["Time", "Temperature", "Tired", "Touch"], a:0 },
  { q: "High blood pressure is a risk for…", opts:["Stroke", "Flu", "Allergy", "Cold"], a:0 },
  { q: "If you see stroke signs you should…",opts:["Call 1669 immediately", "Wait an hour", "Go to sleep", "Search YouTube"], a:0 },
];

// ====== Helpers ======
function renderPoints(n){
  CURRENT_POINTS = n|0;
  const el = document.getElementById("pointsNum");
  if (el) el.textContent = String(CURRENT_POINTS);
}
function nodeElement(index, state){
  const li = document.createElement("li");
  li.className = `node ${state}`;
  li.innerHTML = `
    <div class="badge">${state==="done"?"✓":index+1}</div>
    <div class="label">Checkpoint ${index+1}</div>
  `;
  return li;
}

// ====== Build the path ======
async function buildPath(user){
  const path = document.getElementById("path");
  const allDoneEl = document.getElementById("allDone");
  if (!path) return;

  const docRef = db.collection("users").doc(user.uid);
  const snap = await docRef.get();
  if (!snap.exists) {
    await docRef.set({ username:(user.email||"").split("@")[0], cards:[], mission:Array(LEVEL_COUNT).fill(false), points:0 }, {merge:true});
  }
  const data = (await docRef.get()).data() || {};
  let completed = Array.isArray(data.mission) ? data.mission.slice(0, LEVEL_COUNT) : Array(LEVEL_COUNT).fill(false);
  while (completed.length < LEVEL_COUNT) completed.push(false);
  renderPoints(typeof data.points==="number" ? data.points : 0);

  const activeIdx = completed.findIndex(v=>!v);
  path.innerHTML = "";
  if (activeIdx === -1) {
    allDoneEl.classList.remove("hidden");
    for (let i=0;i<LEVEL_COUNT;i++) path.appendChild(nodeElement(i,"done"));
    return;
  }
  allDoneEl.classList.add("hidden");

  for (let i=0;i<LEVEL_COUNT;i++){
    const state = completed[i] ? "done" : (i===activeIdx ? "active" : "locked");
    const li = nodeElement(i, state);
    const btn = li.querySelector(".badge");
    if (state==="active") btn.addEventListener("click", ()=>startQuiz(i, docRef, completed));
    if (state==="locked") btn.addEventListener("click", ()=>toast("Pass previous checkpoints first."));
    path.appendChild(li);
  }
}

// ====== Quiz flow (keeps your ✕, Back, Next, 10/10, +1 point on first pass) ======
function startQuiz(levelIdx, docRef, completed){
  const modal = document.getElementById("quizModal");
  const box   = document.getElementById("quizBox");
  const questions = BASE_QUESTIONS.map(q=>({...q})); // copy

  let idx=0, correct=0;
  const answers=[];

  function render(){
    const q = questions[idx];
    box.innerHTML = `
      <button class="close-x" id="closeX" aria-label="Close">×</button>
      <div class="q-header">
        <div class="q-title" id="quizTitle">Checkpoint ${levelIdx+1}</div>
        <div class="q-progress">${idx+1}/10</div>
      </div>
      <div class="q-body">${q.q}</div>
      <div class="q-options">
        ${q.opts.map((t,i)=>`<div class="q-option" data-i="${i}">${t}</div>`).join("")}
      </div>
      <div class="q-actions">
        ${idx>0?'<button class="btn btn-grey" id="backBtn">Back</button>':''}
        <button class="btn btn-red" id="nextBtn">${idx<9?'Next':'Finish'}</button>
      </div>
    `;
    modal.classList.add("show");

    // close X
    document.getElementById("closeX").onclick = ()=> modal.classList.remove("show");

    let selected = (answers[idx]!==undefined) ? answers[idx] : -1;
    const opts = [...box.querySelectorAll(".q-option")];
    const highlight =()=>opts.forEach(o=>o.classList.toggle("selected", Number(o.dataset.i)===selected));
    highlight();
    opts.forEach(el=>el.onclick=()=>{ selected=Number(el.dataset.i); answers[idx]=selected; highlight(); });

    if (idx>0) document.getElementById("backBtn").onclick=()=>{ idx--; render(); };

    document.getElementById("nextBtn").onclick = async ()=>{
      if (selected === -1) return;
      if (selected === questions[idx].a) correct++;
      if (idx<9){ idx++; render(); return; }

      // Finished
      const firstTime = !completed[levelIdx];
      completed[levelIdx] = (correct===10);
      if (correct===10){
        if (firstTime){
          await docRef.set({ mission: completed, points: firebase.firestore.FieldValue.increment(1) }, {merge:true});
          renderPoints(CURRENT_POINTS + 1);
        } else {
          await docRef.set({ mission: completed }, {merge:true});
        }
        box.innerHTML = `
          <button class="close-x" id="closeX2" aria-label="Close">×</button>
          <div class="center">
            <h2 class="q-title">🎉 Perfect! 10/10</h2>
            <p>You passed Checkpoint ${levelIdx+1}.</p>
            <p>+1 🧠 point ${firstTime?'(first time)':'(already awarded earlier)'}</p>
            <button class="btn btn-red" id="okBtn">OK</button>
          </div>`;
        document.getElementById("closeX2").onclick=()=>modal.classList.remove("show");
        document.getElementById("okBtn").onclick = ()=>location.reload();
      } else {
        box.innerHTML = `
          <button class="close-x" id="closeX3" aria-label="Close">×</button>
          <div class="center">
            <h2 class="q-title">Keep going!</h2>
            <p>You scored <b>${correct}/10</b>. You must get <b>10/10</b> to pass.</p>
            <div class="q-actions" style="justify-content:center">
              <button class="btn btn-grey" id="closeBtn">Close</button>
              <button class="btn btn-red" id="retryBtn">Try again</button>
            </div>
          </div>`;
        document.getElementById("closeX3").onclick=()=>modal.classList.remove("show");
        document.getElementById("closeBtn").onclick = ()=>modal.classList.remove("show");
        document.getElementById("retryBtn").onclick = ()=>{ idx=0; correct=0; answers.length=0; render(); };
      }
    };
  }
  render();
}

// ====== Small toast modal reused for notices ======
function toast(msg){
  const modal = document.getElementById("quizModal");
  const box   = document.getElementById("quizBox");
  box.innerHTML = `
    <button class="close-x" id="closeNoticeX" aria-label="Close">×</button>
    <div class="center">
      <h3 class="q-title">Notice</h3>
      <p>${msg}</p>
      <button class="btn btn-red" id="closeNotice">OK</button>
    </div>`;
  modal.classList.add("show");
  document.getElementById("closeNoticeX").onclick = ()=>modal.classList.remove("show");
  document.getElementById("closeNotice").onclick  = ()=>modal.classList.remove("show");
                      }
