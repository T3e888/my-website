// ====== Auth guard ======
const auth = firebase.auth();
const db   = firebase.firestore();

const LEVEL_COUNT = 15; // 15 checkpoints
let CURRENT_POINTS = 0;

// tiny safe logger
const log = (...a) => { try { console.log(...a); } catch(_){} };

// ====== Start ======
auth.onAuthStateChanged(async (user) => {
  if (!user) return location.href = "login.html";
  setupSidebar();
  try { await buildPath(user); }
  catch (e) { log("buildPath error:", e); toast("Small loading error. Refresh and try again."); }
});

// ====== Sidebar ======
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

// ====== QUESTION BANKS ======
const Q1_BASIC = [
  { q:"How many main types of stroke are there?", opts:["One","Two: Ischemic & Hemorrhagic","Three","Four"], a:1 },
  { q:"What does 'stroke' mean?", opts:[
      "A muscle injury","Sudden brain problem from blocked or bleeding vessels",
      "Only a headache","A broken bone"], a:1 },
  { q:"Which statement is TRUE?", opts:[
      "Ischemic = bleeding, Hemorrhagic = blockage",
      "Ischemic = blockage, Hemorrhagic = bleeding",
      "Both are the same","Neither harms the brain"], a:1 },
  { q:"TIA is…", opts:[
      "A permanent stroke","A mini-stroke that warns of higher risk",
      "A heart attack","A migraine"], a:1 },
  { q:"Why called 'cerebrovascular' disease?", opts:[
      "Because it’s about the lungs","Because it’s about brain blood vessels",
      "Because it’s about the stomach","Because it’s about skin"], a:1 },
  { q:"Is stroke an emergency?", opts:["No","Only if painful","Yes, every minute matters","Only for older people"], a:2 },
  { q:"Main arteries that supply the brain?", opts:[
      "Carotid & vertebral arteries","Radial & ulnar arteries",
      "Femoral & popliteal","Aorta only"], a:0 },
  { q:"Permanent damage can begin after ~… of no blood flow.", opts:["30–60 min","4–5 min","1–2 days","10–12 hours"], a:1 },
  { q:"Can young people have a stroke?", opts:["Never","Yes, if risk factors exist","Only athletes","Only smokers"], a:1 },
  { q:"In Thailand, cases are…", opts:[
      "Decreasing","Increasing with aging & risky habits","Gone","Unknown"], a:1 },
];

const Q2_CAUSES = [
  { q:"Most important risk for hemorrhagic stroke?", opts:["Low BP","High BP","Low sugar","Cold weather"], a:1 },
  { q:"Which heart condition raises stroke risk?", opts:["Atrial fibrillation","Athlete’s heart","Healthy valve","Bradycardia"], a:0 },
  { q:"High blood pressure increases risk because…", opts:[
      "It strengthens vessels","It damages vessel walls","It thins the blood","It cools the brain"], a:1 },
  { q:"Smoking does what?", opts:[
      "Protects vessels","Has no effect","Damages vessels & increases clotting","Cures stroke"], a:2 },
  { q:"Diabetes relates to stroke because…", opts:[
      "It repairs vessels","It damages small vessels & speeds narrowing","It prevents clots","It lowers cholesterol"], a:1 },
  { q:"High cholesterol…", opts:[
      "Creates fatty plaques that narrow arteries","Thins blood","Is always harmless","Prevents blockage"], a:0 },
  { q:"Atrial fibrillation can…", opts:[
      "Form heart clots that travel to the brain","Stop clots forming","Lower BP","Cure diabetes"], a:0 },
  { q:"Excess alcohol may…", opts:[
      "Lower BP","Raise BP & cause rhythm problems","Prevent stroke","Improve sleep only"], a:1 },
  { q:"Chronic stress…", opts:[
      "Has no link","Can raise BP & unhealthy habits","Cures anxiety","Prevents clots"], a:1 },
  { q:"Which are controllable risks?", opts:[
      "Age & genetics","Diet, exercise, BP, smoking","Gender only","Height"], a:1 },
];

const Q3_PREVENT = [
  { q:"A stroke-smart diet focuses on…", opts:[
      "Fried foods & salt","Fruits/veg, whole grains, fish, less salt/sugar","Only meat","Only supplements"], a:1 },
  { q:"Recommended activity per week?", opts:[
      "150 min moderate + strength 2 days","30 min total","None if young","Only weekends"], a:0 },
  { q:"Controlling BP helps because…", opts:[
      "It prevents vessel damage","It makes you taller","It changes blood type","It lowers vision"], a:0 },
  { q:"Quit smoking effect on stroke risk?", opts:[
      "No change","Falls a lot in 1–2 yrs; near non-smoker ~5 yrs","Increases risk","Only helps lungs"], a:1 },
  { q:"Health check-ups help by…", opts:[
      "Giving free snacks","Detecting & treating risks early","Making you sleepy","Raising BP"], a:1 },
  { q:"Overweight/obesity…", opts:[
      "Lower risk","No effect","Raise risk via BP, diabetes, cholesterol","Only cosmetic"], a:2 },
  { q:"Control blood sugar to…", opts:[
      "Damage vessels","Prevent vessel damage","Gain weight","Change eye color"], a:1 },
  { q:"Too little sleep…", opts:[
      "May raise BP & stress","Is always safe","Cures stress","Prevents clots"], a:0 },
  { q:"Managing stress helps by…", opts:[
      "Keeping BP healthy & habits better","Ruining sleep","Raising cholesterol","Causing clots"], a:0 },
  { q:"Hydration…", opts:[
      "Hurts circulation","Helps overall health & circulation","Causes stroke","Replaces exercise"], a:1 },
];

const Q4_BEFAST = [
  { q:"BEFAST stands for…", opts:[
      "Brain, Eye, Feet, Arms, Speech, Talk",
      "Balance, Eyes, Face, Arms, Speech, Time",
      "Breathe, Eat, Fast, Act, Sit, Talk",
      "Blink, Ear, Face, Abdomen, Sleep, Time"], a:1 },
  { q:"B = ?", opts:["Breath","Balance problems","Bones","Belief"], a:1 },
  { q:"E = ?", opts:["Ears ache","Eyes: sudden vision problems","Energy low","Elbows weak"], a:1 },
  { q:"F = ?", opts:["Fever","Face drooping","Foot pain","Food allergy"], a:1 },
  { q:"A = ?", opts:["Arm weakness","Ankle sprain","Asthma","Anemia"], a:0 },
  { q:"S = ?", opts:["Sleepiness","Speech trouble","Sweating","Sunburn"], a:1 },
  { q:"T = ?", opts:["Tomorrow","Time to call emergency","Tea time","Take a nap"], a:1 },
  { q:"If BEFAST signs appear you should…", opts:[
      "Wait at home","Call 1669 immediately","Drink water","Search YouTube"], a:1 },
  { q:"Why is time critical?", opts:[
      "Brain survives forever","Earlier treatment saves brain","Ambulances like speed","It isn’t"], a:1 },
  { q:"Why not wait for symptoms to go away?", opts:[
      "It’s safer to delay","Delays treatment → permanent damage","Hospitals are closed","Water will fix it"], a:1 },
];

const Q5_TREAT = [
  { q:"First thing if someone may have a stroke?", opts:[
      "Give food","Call for help and get to hospital fast","Let them sleep","Massage"], a:1 },
  { q:"Why reach hospital quickly?", opts:[
      "Better chance of effective treatment & recovery","To pay bills earlier","To avoid paperwork","No reason"], a:0 },
  { q:"What machine checks the type of stroke?", opts:["Ultrasound","CT/MRI","X-ray of leg","Thermometer"], a:1 },
  { q:"If a vessel is blocked, doctors may…", opts:[
      "Give clot-busting medicine","Give sleeping pills","Do nothing","Only ice"], a:0 },
  { q:"If a vessel bursts, doctors…", opts:[
      "Let it bleed","Stop bleeding (sometimes surgery)","Give candy","Send home"], a:1 },
  { q:"Why physical therapy after stroke?", opts:[
      "To regain strength & movement","To learn cooking","No reason","To avoid friends"], a:0 },
  { q:"Who helps with speech problems?", opts:[
      "Dentist","Speech therapist","Chef","Pilot"], a:1 },
  { q:"Healthy food during recovery…", opts:[
      "Slows healing","Provides nutrients for healing","Blocks blood flow","Is useless"], a:1 },
  { q:"Family encouragement…", opts:[
      "Doesn’t matter","Helps motivation to recover","Harms recovery","Replaces medicine"], a:1 },
  { q:"To prevent another stroke, people should…", opts:[
      "Ignore BP","Eat healthy, exercise, control BP, see doctor","Only rest forever","Avoid water"], a:1 },
];

// Category map: 1–3 → Q1, 4–6 → Q2, 7–9 → Q3, 10–12 → Q4, 13–15 → Q5
function categoryForLevel(levelIdx){ return Math.floor(levelIdx / 3) + 1; } // 1..5
function bankForCategory(cat){ return [null, Q1_BASIC, Q2_CAUSES, Q3_PREVENT, Q4_BEFAST, Q5_TREAT][cat] || Q1_BASIC; }

// ====== helpers ======
function shuffle(arr){
  const a = arr.slice();
  for (let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
function pickQuestionsForCheckpoint(levelIdx){
  const cat = categoryForLevel(levelIdx);
  const bank = bankForCategory(cat);
  return shuffle(bank).slice(0, 10).map(q => ({...q}));
}
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
    await docRef.set({
      username:(user.email||"").split("@")[0],
      cards:[],
      mission:Array(LEVEL_COUNT).fill(false),
      points:0
    }, {merge:true});
  }

  const data = (await docRef.get()).data() || {};
  let completed = Array.isArray(data.mission) ? data.mission.slice(0, LEVEL_COUNT) : Array(LEVEL_COUNT).fill(false);
  while (completed.length < LEVEL_COUNT) completed.push(false);

  // ✅ Normalize Firestore: ensure 15 items actually stored (fixes older 10-slot users)
  if (!Array.isArray(data.mission) || data.mission.length !== LEVEL_COUNT) {
    await docRef.set({ mission: completed }, { merge: true });
  }

  renderPoints(typeof data.points==="number" ? data.points : 0);

  const activeIdx = completed.findIndex(v=>!v);
  path.innerHTML = "";
  if (activeIdx === -1) {
    allDoneEl?.classList.remove("hidden");
    for (let i=0;i<LEVEL_COUNT;i++) path.appendChild(nodeElement(i,"done"));
    return;
  }
  allDoneEl?.classList.add("hidden");

  for (let i=0;i<LEVEL_COUNT;i++){
    const state = completed[i] ? "done" : (i===activeIdx ? "active" : "locked");
    const li = nodeElement(i, state);
    const btn = li.querySelector(".badge");
    if (state==="active") btn.addEventListener("click", ()=>startQuiz(i, docRef, completed));
    if (state==="locked") btn.addEventListener("click", ()=>toast("Pass previous checkpoints first."));
    path.appendChild(li);
  }
}

// ====== Quiz flow ======
function startQuiz(levelIdx, docRef, completed){
  const modal = document.getElementById("quizModal");
  const box   = document.getElementById("quizBox");

  const questions = pickQuestionsForCheckpoint(levelIdx);
  let idx = 0;
  const answers = Array(10).fill(undefined);

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

    document.getElementById("closeX").onclick = ()=> modal.classList.remove("show");

    // restore selection
    let selected = (answers[idx] !== undefined) ? answers[idx] : -1;
    const opts = [...box.querySelectorAll(".q-option")];
    const highlight =()=>opts.forEach(o=>o.classList.toggle("selected", Number(o.dataset.i)===selected));
    highlight();
    opts.forEach(el=>el.onclick=()=>{ selected=Number(el.dataset.i); answers[idx]=selected; highlight(); });

    if (idx>0) document.getElementById("backBtn").onclick=()=>{ idx--; render(); };

    document.getElementById("nextBtn").onclick = async ()=>{
      if (selected === -1) return;
      if (idx < 9) { idx++; render(); return; }

      // Finished — compute score
      const correct = answers.reduce((sum,ans,i)=> sum + (ans===questions[i].a ? 1 : 0), 0);
      const firstTime = !completed[levelIdx];

      if (correct === 10){
        completed[levelIdx] = true;
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
        document.getElementById("retryBtn").onclick = ()=>{
          const fresh = pickQuestionsForCheckpoint(levelIdx);
          for (let i=0;i<10;i++) questions[i] = fresh[i];
          idx = 0; answers.fill(undefined); render();
        };
      }
    };
  }
  render();
}

// ====== Simple notice modal ======
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
