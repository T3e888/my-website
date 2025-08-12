<!-- mission.html should already load firebase compat SDKs.
     Just replace your mission.js file with this content. -->
<script>
// ====== Auth guard & setup ======
const auth = firebase.auth();
const db   = firebase.firestore();

const LEVEL_COUNT = 15;
let CURRENT_POINTS = 0; // in-memory cache for HUD

auth.onAuthStateChanged(async (user) => {
  if (!user) { location.href = "login.html"; return; }
  initUIBasics();
  ensurePointsHud();
  await buildPath(user);
});

// ====== Sidebar small logic ======
function initUIBasics() {
  const toggleBtn = document.getElementById("menu-toggle");
  const sidebar   = document.getElementById("sidebar");
  const overlay   = document.getElementById("overlay");
  const closeBtn  = document.getElementById("close-sidebar");
  const logout    = document.getElementById("logout-link");

  toggleBtn?.addEventListener("click", () => { sidebar.classList.add("open"); overlay.classList.add("active"); });
  function close() { sidebar.classList.remove("open"); overlay.classList.remove("active"); }
  closeBtn?.addEventListener("click", close);
  overlay?.addEventListener("click", close);
  logout?.addEventListener("click", (e) => { e.preventDefault(); auth.signOut().then(() => location.href = "login.html"); });
}

// ====== HUD helpers ======
function ensurePointsHud(){
  if (!document.querySelector(".points-hud")) {
    const hud = document.createElement("div");
    hud.className = "points-hud";
    hud.innerHTML = `🧠 <span id="pointsNum">0</span>`;
    document.body.appendChild(hud);
  }
}
function renderPoints(n) {
  CURRENT_POINTS = n;
  const el = document.getElementById("pointsNum");
  if (el) el.textContent = String(n);
}

// ====== Question bank by category ======
// Each question: { q, opts:[...4], a:indexOfCorrect }
const CAT1 = [
  {q:"How many main types of stroke are there, and what are they?",
    opts:["Two types: Ischemic & Hemorrhagic","One type only","Three types","Four types"],a:0},
  {q:"What does the word “stroke” mean?",
    opts:["Sudden brain malfunction from blocked/bleeding vessels","Just a bad headache","Only fainting","A muscle cramp"],a:0},
  {q:"Difference between ischemic and hemorrhagic stroke?",
    opts:["Blocked vessel vs ruptured vessel","Both are infections","One is allergy, one is fever","Different bones affected"],a:0},
  {q:"What is a TIA (Transient Ischemic Attack)?",
    opts:["A mini-stroke with temporary symptoms (warning)","A stomach illness","An ear infection","Only a migraine"],a:0},
  {q:"Why called cerebrovascular disease?",
    opts:["Because it involves brain blood vessels","Because it affects the lungs","Because it’s a skin problem","Because it’s only about nerves"],a:0},
  {q:"Is stroke an emergency? Why?",
    opts:["Yes—brain cells die within minutes","Not really, wait at home","Only if there’s a fever","Only if you’re over 60"],a:0},
  {q:"Where does the brain receive blood from?",
    opts:["Carotid & vertebral arteries","Arm arteries","Leg veins only","Liver vessels"],a:0},
  {q:"How many minutes without blood can injure the brain?",
    opts:["About 4–5 minutes","About 30 minutes","More than 2 hours","It never gets injured"],a:0},
  {q:"Can young people have a stroke?",
    opts:["Yes, if risk factors exist","No, only elderly","Only athletes","Only children"],a:0},
  {q:"Are stroke cases increasing in Thailand? Why?",
    opts:["Yes, due to aging & unhealthy habits","No, they’re disappearing","Only during winter","Only because of sports"],a:0},
];

const CAT2 = [
  {q:"Most important risk factor for hemorrhagic stroke?",
    opts:["High blood pressure","Low blood sugar","Sunlight","Dehydration"],a:0},
  {q:"Which heart disease raises stroke risk?",
    opts:["Atrial fibrillation","Healthy heartbeat","Broken toe","Appendicitis"],a:0},
  {q:"Why does high blood pressure raise stroke risk?",
    opts:["Damages vessel walls → can block or burst","Makes bones stronger","Only causes rash","It lowers cholesterol"],a:0},
  {q:"How does smoking affect stroke risk?",
    opts:["Damages vessels & increases clots","Makes lungs pink","No effect","Protects from clots"],a:0},
  {q:"Diabetes is related to stroke because…",
    opts:["High sugar damages blood vessels","It cures vessel disease","It only affects skin","It cleans arteries"],a:0},
  {q:"How does high cholesterol increase stroke risk?",
    opts:["Plaque builds up and narrows arteries","It strengthens arteries","It helps blood flow","It prevents clots"],a:0},
  {q:"Atrial fibrillation increases risk because…",
    opts:["Clots can form in the heart and travel to brain","It improves rhythm","It lowers BP","It removes plaques"],a:0},
  {q:"Excessive alcohol increases risk by…",
    opts:["Raising BP and causing rhythm problems","Growing muscles","Fixing cholesterol","Hydrating brain"],a:0},
  {q:"Can chronic stress link to stroke?",
    opts:["Yes—raises BP & unhealthy habits","No link at all","Only helps sleep","Only improves diet"],a:0},
  {q:"Which risks are controllable vs not?",
    opts:["Controllable: diet/exercise/BP/smoking; Uncontrollable: age/family history/gender",
          "All risks are uncontrollable","Only gender is controllable","Nothing is controllable"],a:0},
];

const CAT3 = [
  {q:"Which diet helps reduce stroke risk?",
    opts:["Fruits/vegetables/fish/whole grains; low salt, sugar, bad fats",
          "Only meat & fries","Only sweets","Skip breakfast"],a:0},
  {q:"How does exercise help?",
    opts:["Improves heart health & BP; manages weight","Only makes you tired","Raises BP dangerously","No effect"],a:0},
  {q:"Why control blood pressure?",
    opts:["Prevents damage to brain vessels","To get taller","To change eye color","No reason"],a:0},
  {q:"Quitting smoking reduces risk by…",
    opts:["Dropping risk within 1–2 years; ~5 years near non-smoker","No change ever","Only after 50 years","Increases risk"],a:0},
  {q:"Annual health check-ups help because…",
    opts:["Find & treat risks early","They are just for certificates","They cause disease","They replace sleep"],a:0},
  {q:"Overweight/obesity relate to stroke because…",
    opts:["Raise BP, diabetes, cholesterol","Only change hair color","Make bones longer","No relation"],a:0},
  {q:"Why control blood sugar?",
    opts:["To avoid vessel damage","To grow muscles fast","To tan skin","No reason"],a:0},
  {q:"Does lack of sleep affect risk?",
    opts:["Yes—raises BP & stress","No effect","It cures stroke","It lowers BP safely"],a:0},
  {q:"How does stress management help?",
    opts:["Keeps BP healthy and avoids bad habits","Only wastes time","Raises BP","Causes insomnia"],a:0},
  {q:"Does drinking enough water help?",
    opts:["Yes—supports good circulation & health","No, avoid water","Only soda helps","Water blocks vessels"],a:0},
];

const CAT4 = [
  {q:"What does BEFAST stand for?",
    opts:["Balance, Eyes, Face, Arms, Speech, Time","Brain, Ear, Foot, Arm, Skin, Taste","Back, Eye, Finger, Ankle, Sleep, Tea","Balance, Ear, Face, Ankle, Sugar, Temperature"],a:0},
  {q:"What does 'B' mean in BEFAST?",
    opts:["Sudden loss of balance/dizziness","Back pain only","Better mood","Blue lips"],a:0},
  {q:"What does 'E' mean in BEFAST?",
    opts:["Sudden vision loss/double vision","Ear ringing","Eye color change only","Eyebrow twitch"],a:0},
  {q:"What does 'F' mean in BEFAST?",
    opts:["Face drooping on one side","Foot cramps","Fever","Finger pain"],a:0},
  {q:"What does 'A' mean in BEFAST?",
    opts:["Arm weakness / cannot raise one arm","Ankle swelling","Abdominal gas","Arm itch"],a:0},
  {q:"What does 'S' mean in BEFAST?",
    opts:["Slurred speech / difficulty speaking","Sleepy","Sneezing","Silent movie"],a:0},
  {q:"What does 'T' mean in BEFAST?",
    opts:["Time to call emergency immediately","Take a nap","Try later","Talk softly"],a:0},
  {q:"What should you do if BEFAST signs appear?",
    opts:["Call an ambulance right away","Wait 24 hours","Drink water only","Search videos first"],a:0},
  {q:"Why is time so important?",
    opts:["Faster treatment saves more brain","Hospitals get bored","Ambulances need practice","No reason"],a:0},
  {q:"Why is waiting dangerous?",
    opts:["Delays care → permanent damage/death","It cures itself","It lowers risk","It improves vision"],a:0},
];

const CAT5 = [
  {q:"First thing to do if someone has a stroke?",
    opts:["Call for help and go to hospital immediately","Give food and wait","Make them sleep","Drive around"],a:0},
  {q:"Why go to hospital quickly?",
    opts:["Faster treatment → better recovery","For free snacks","To rest in lobby","No benefit"],a:0},
  {q:"What machine checks kind of stroke?",
    opts:["CT scan or MRI","X-ray of the foot","Thermometer","Stethoscope only"],a:0},
  {q:"If a vessel is blocked, doctors may…",
    opts:["Give clot-busting medicine (time-limited)","Give only vitamins","Do nothing","Only massage"],a:0},
  {q:"If a vessel bursts, doctors may…",
    opts:["Stop bleeding, sometimes surgery","Give candy","Only bed rest","Ignore it"],a:0},
  {q:"Why practice walking/hand use after treatment?",
    opts:["To regain strength and movement","To learn dancing","For fun only","No reason"],a:0},
  {q:"Who helps patients speak better again?",
    opts:["Speech therapist","Dentist","Chef","Plumber"],a:0},
  {q:"How does healthy food help recovery?",
    opts:["Provides nutrients to heal & get stronger","It makes you sleepy","No effect","It weakens muscles"],a:0},
  {q:"Why should families encourage patients?",
    opts:["Motivation supports recovery","To make noise","To replace medicine","No reason"],a:0},
  {q:"How to avoid another stroke after recovery?",
    opts:["Eat healthy, exercise, control BP, keep follow-ups","Skip medicines","Never move","Eat only sweets"],a:0},
];

// Map level index (0..14) → category array
function categoryForLevel(levelIdx){
  const catNo = Math.floor(levelIdx/3) + 1; // 1..5
  return [CAT1,CAT2,CAT3,CAT4,CAT5][catNo-1];
}

// ====== Build path & bind clicks ======
async function buildPath(user) {
  const path = document.getElementById("path");
  const allDoneEl = document.getElementById("allDone");

  const docRef = db.collection("users").doc(user.uid);
  const snap = await docRef.get();

  if (!snap.exists) {
    await docRef.set({
      username: (user.email||"").split("@")[0],
      cards: [],
      mission: Array(LEVEL_COUNT).fill(false),
      points: 0
    }, { merge: true });
  }

  const data = (await docRef.get()).data() || {};
  let completed = Array.isArray(data.mission) ? data.mission.slice(0, LEVEL_COUNT) : Array(LEVEL_COUNT).fill(false);
  while (completed.length < LEVEL_COUNT) completed.push(false);
  renderPoints(typeof data.points === "number" ? data.points : 0);

  // find first active level (first false)
  let activeIdx = completed.findIndex(v => !v);
  if (activeIdx === -1) {
    path.innerHTML = "";
    allDoneEl.classList.remove("hidden");
    for (let i=0;i<LEVEL_COUNT;i++) path.appendChild(nodeElement(i,"done"));
    return;
  }

  allDoneEl.classList.add("hidden");
  path.innerHTML = "";
  for (let i=0;i<LEVEL_COUNT;i++) {
    const state = completed[i] ? "done" : (i === activeIdx ? "active" : "locked");
    const li = nodeElement(i, state);
    if (state === "active") {
      li.querySelector(".badge").addEventListener("click", () => startQuiz(i, docRef, completed));
    } else if (state === "locked") {
      li.querySelector(".badge").addEventListener("click", () => toast("Pass previous checkpoints first."));
    }
    path.appendChild(li);
  }
}

function nodeElement(index, state) {
  const li = document.createElement("li");
  li.className = `node ${state}`;
  li.innerHTML = `
    <div class="badge">${state==="done"?"✓":index+1}</div>
    <div class="label">Checkpoint ${index+1}</div>
  `;
  return li;
}

// ====== Quiz flow ======
function startQuiz(levelIdx, docRef, completed) {
  const modal = document.getElementById("quizModal");
  const box   = document.getElementById("quizBox");

  // Take the 10 Qs from the category and shuffle order
  const source = categoryForLevel(levelIdx).map(q => ({...q, opts:[...q.opts]}));
  shuffle(source);

  const questions = source.slice(0,10); // (currently 10 in each category)
  let idx = 0, correct = 0;
  const answers = [];

  render();

  function render() {
    const q = questions[idx];
    box.innerHTML = `
      <div class="q-header">
        <div class="q-title">Checkpoint ${levelIdx+1}</div>
        <div class="q-progress">${idx+1}/10</div>
        <button class="close-x" id="closeX" aria-label="Close">×</button>
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

    document.getElementById("closeX").onclick = () => modal.classList.remove("show");

    let selected = (answers[idx] !== undefined) ? answers[idx] : -1;
    const opts = [...box.querySelectorAll(".q-option")];
    highlight();

    opts.forEach(el => {
      el.onclick = () => { selected = Number(el.dataset.i); answers[idx] = selected; highlight(); };
    });

    function highlight(){ opts.forEach(o => o.classList.toggle("selected", Number(o.dataset.i)===selected)); }

    document.getElementById("nextBtn").onclick = async () => {
      if (selected === -1) return;
      if (selected === questions[idx].a) correct++;

      if (idx < 9) {
        idx++; render();
      } else {
        // finished
        if (correct === 10) {
          const firstTimePass = !completed[levelIdx];
          completed[levelIdx] = true;

          if (firstTimePass) {
            await docRef.set(
              { mission: completed, points: firebase.firestore.FieldValue.increment(1) },
              { merge: true }
            );
            renderPoints(CURRENT_POINTS + 1);
          } else {
            await docRef.set({ mission: completed }, { merge: true });
          }

          box.innerHTML = `
            <div class="center">
              <h2 class="q-title">🎉 Perfect! 10/10</h2>
              <p>You passed Checkpoint ${levelIdx+1}.</p>
              <p>+1 🧠 point ${firstTimePass ? "(first time)" : "(already awarded earlier)"} </p>
              <button class="btn btn-red" id="okBtn">OK</button>
            </div>`;
          document.getElementById("okBtn").onclick = () => location.reload();

        } else {
          box.innerHTML = `
            <div class="center">
              <h2 class="q-title">Keep going!</h2>
              <p>You scored <b>${correct}/10</b>. You must get <b>10/10</b> to pass.</p>
              <div class="q-actions" style="justify-content:center">
                <button class="btn btn-grey" id="closeBtn">Close</button>
                <button class="btn btn-red" id="retryBtn">Try again</button>
              </div>
            </div>`;
          document.getElementById("closeBtn").onclick = () => modal.classList.remove("show");
          document.getElementById("retryBtn").onclick = () => { idx = 0; correct = 0; answers.length = 0; shuffle(questions); render(); };
        }
      }
    };
    if (idx>0) document.getElementById("backBtn").onclick = () => { idx--; render(); };
  }
}

function toast(msg){
  const modal = document.getElementById("quizModal");
  const box   = document.getElementById("quizBox");
  box.innerHTML = `
    <div class="center">
      <h3 class="q-title">Notice</h3>
      <p>${msg}</p>
      <button class="btn btn-red" id="closeNotice">OK</button>
    </div>`;
  modal.classList.add("show");
  document.getElementById("closeNotice").onclick = () => modal.classList.remove("show");
}

// utils
function shuffle(arr){
  for (let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
}
</script>
