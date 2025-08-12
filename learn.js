<script>
const auth = firebase.auth();

auth.onAuthStateChanged(user=>{
  if(!user){ location.href = "login.html"; return; }
  setupSidebar(); buildPage();
});

function setupSidebar(){
  const toggleBtn = document.getElementById("menu-toggle");
  const sidebar   = document.getElementById("sidebar");
  const overlay   = document.getElementById("overlay");
  const closeBtn  = document.getElementById("close-sidebar");
  const logout    = document.getElementById("logout-link");
  toggleBtn?.addEventListener("click", ()=>{sidebar.classList.add("open");overlay.classList.add("active");});
  function close(){sidebar.classList.remove("open");overlay.classList.remove("active");}
  closeBtn?.addEventListener("click", close);
  overlay?.addEventListener("click", close);
  logout?.addEventListener("click", (e)=>{e.preventDefault(); auth.signOut().then(()=>location.href="login.html");});
}

/* Slide content (your text) */
const SLIDES = [
  {
    title:"Basic Knowledge about Stroke",
    brief:"What stroke is, types, TIA, and why time matters.",
    html: `
      <p><b>Stroke</b> = brain lacks blood flow or has bleeding → sudden malfunction. Go to hospital immediately.</p>
      <h4>Two main types</h4>
      <ul>
        <li><b>Ischemic</b> (~80–85%): vessel narrowed/blocked → less blood.</li>
        <li><b>Hemorrhagic</b> (~15–20%): vessel ruptures → bleeding.</li>
      </ul>
      <p><b>TIA</b>: stroke-like symptoms that disappear within 24 hrs. It’s a <i>warning stroke</i>.</p>
      <p>Called <b>cerebrovascular</b> because it involves brain blood vessels. Blood arrives via <b>carotid</b> & <b>vertebral</b> arteries.</p>
      <p><b>Time matters:</b> permanent damage can begin in about 4–5 minutes.</p>
      <p>Can happen at any age (risk ↑ with age). In Thailand, cases rising with aging & risky lifestyles.</p>
      <p><b>Summary:</b> Medical emergency. “Time = Brain”.</p>
    `
  },
  {
    title:"Causes & Risk Factors",
    brief:"Blockage vs rupture and key risks you can control.",
    html: `
      <h4>Main mechanisms</h4>
      <ul>
        <li><b>Blockage</b> (clot in brain/neck or from heart – atrial fibrillation).</li>
        <li><b>Rupture</b> (weak wall from long-term high BP, aneurysm, AVM).</li>
      </ul>
      <h4>Controllable risks</h4>
      <ul>
        <li>High blood pressure (most important)</li><li>Smoking</li><li>Diabetes</li>
        <li>High cholesterol</li><li>Excess alcohol</li><li>Obesity & inactivity</li>
        <li>Chronic stress / lack of sleep</li>
      </ul>
      <h4>Uncontrollable</h4>
      <ul><li>Age, family history, gender</li></ul>
      <p><b>Summary:</b> Control BP, sugar, cholesterol; quit smoking; exercise.</p>
    `
  },
  {
    title:"Prevention & Self-Care",
    brief:"Diet, exercise, sleep, stress, check-ups.",
    html: `
      <ul>
        <li><b>Diet:</b> fruit/veg, whole grains, fish, nuts; reduce salt/sugar/fried fats.</li>
        <li><b>Exercise:</b> 150 min/week + 2 strength days.</li>
        <li><b>Quit smoking:</b> risk drops in 1–2 yrs; ~5 yrs near non-smoker.</li>
        <li><b>Limit alcohol</b>, keep healthy weight & waist.</li>
        <li><b>Sleep</b> 7–9 h; manage stress; stay hydrated.</li>
        <li><b>Check-ups</b> & follow doctor advice.</li>
      </ul>
    `
  },
  {
    title:"Warning Signs & First Aid (BEFAST)",
    brief:"Know the signs. Call 1669 fast.",
    html: `
      <p><b>BEFAST:</b> Balance, Eyes, Face, Arms, Speech, Time.</p>
      <ul>
        <li><b>B</b> – sudden dizziness/unsteady walking</li>
        <li><b>E</b> – sudden blurred/double vision or one-eye blindness</li>
        <li><b>F</b> – face droop</li>
        <li><b>A</b> – arm/leg weakness</li>
        <li><b>S</b> – slurred speech / can’t speak</li>
        <li><b>T</b> – <b>Time</b>: call <b>1669</b> immediately</li>
      </ul>
      <p>Quick test: smile / raise both arms / say a short sentence.</p>
      <p><b>Don’t:</b> wait, give food/drink/medicine, or drive yourself if severe.</p>
    `
  },
  {
    title:"Treatment & Recovery (Elementary)",
    brief:"What hospitals do and how to recover well.",
    html: `
      <ul>
        <li><b>At once:</b> tell an adult, call 1669, go to hospital quickly.</li>
        <li><b>Check:</b> CT/MRI to see block vs bleed.</li>
        <li><b>If block:</b> clot-busting medicine (time-limited).</li>
        <li><b>If bleed:</b> stop bleeding, sometimes surgery.</li>
      </ul>
      <p><b>After emergency:</b> physical/speech/occupational therapy; healthy food; rest; encouragement; prevent another stroke (BP, sugar, cholesterol, exercise, follow-ups).</p>
    `
  }
];

function buildPage(){
  const grid = document.getElementById("learnGrid");
  grid.innerHTML = "";
  SLIDES.forEach((s,idx)=>{
    const card = document.createElement("div");
    card.className = "learn-card";
    card.innerHTML = `<h3>Slide ${idx+1} — ${s.title}</h3><p>${s.brief}</p>`;
    card.onclick = ()=> openModal(s.title, s.html);
    grid.appendChild(card);
  });

  const modal = document.getElementById("learnModal");
  document.getElementById("closeLearn").onclick = ()=> modal.classList.remove("show");
  modal.addEventListener("click", e => { if (e.target === modal) modal.classList.remove("show"); });
}

function openModal(title, html){
  document.getElementById("mTitle").textContent = title;
  document.getElementById("mBody").innerHTML = html;
  document.getElementById("learnModal").classList.add("show");
}
</script>
