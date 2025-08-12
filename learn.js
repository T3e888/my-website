const auth = firebase.auth();

auth.onAuthStateChanged(user=>{
  if(!user) return location.href="login.html";
  setupSidebar();
  buildLearn();
});

// Sidebar identical behavior
function setupSidebar(){
  const toggleBtn=document.getElementById("menu-toggle");
  const sidebar=document.getElementById("sidebar");
  const overlay=document.getElementById("overlay");
  const closeBtn=document.getElementById("close-sidebar");
  const logout=document.getElementById("logout-link");

  const open=()=>{sidebar.classList.add("open");overlay.classList.add("active");};
  const close=()=>{sidebar.classList.remove("open");overlay.classList.remove("active");};

  toggleBtn?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  overlay?.addEventListener("click", close);
  document.querySelectorAll("#sidebar .menu-item a").forEach(a=>{
    if(!a.closest("#logout-link")) a.addEventListener("click", close);
  });
  logout?.addEventListener("click",(e)=>{e.preventDefault();auth.signOut().then(()=>location.href="login.html");});
}

// Content slides (shortened to keep file small; you can expand freely)
const SLIDES = [
  { title:"Basic Knowledge about Stroke",
    brief:"What stroke is and why time matters.",
    html: `
      <h2>Basic Knowledge about Stroke</h2>
      <p><b>Stroke</b> = the brain lacks blood flow or has bleeding → sudden malfunction. It’s a medical emergency.</p>
      <ul>
        <li><b>Ischemic</b> (≈80–85%): vessel blocked → low blood flow.</li>
        <li><b>Hemorrhagic</b> (≈15–20%): vessel ruptures → bleeding.</li>
      </ul>
      <p><b>TIA</b> = stroke-like symptoms that disappear within 24 hours → warning stroke → see a doctor.</p>
      <p>Brain blood supply from carotid & vertebral arteries. Damage can begin in ~4–5 minutes without blood.</p>
      <p><i>Summary:</i> Time = Brain. Call emergency immediately.</p>`
  },
  { title:"Causes & Risk Factors",
    brief:"Blockage, rupture, and what increases risk.",
    html: `
      <h2>Causes & Risk Factors</h2>
      <p><b>Blockage</b>: clot in brain/neck or from heart (e.g., atrial fibrillation).</p>
      <p><b>Rupture</b>: weak vessel walls from long-term high blood pressure, aneurysm.</p>
      <p><b>Controllable</b>: high BP, smoking, diabetes, high cholesterol, alcohol, obesity/inactivity, stress/sleep.</p>
      <p><b>Uncontrollable</b>: age, family history, gender.</p>
      <p>Control BP/sugar/cholesterol, quit smoking, exercise → lower risk.</p>`
  },
  { title:"Prevention & Self-Care",
    brief:"Daily habits that protect your brain.",
    html: `
      <h2>Prevention & Self-Care</h2>
      <p>Eat heart-healthy, exercise 150 min/week, quit smoking, limit alcohol.</p>
      <p>Control weight & waist, sleep 7–9h, manage stress, hydrate.</p>
      <p>Regular check-ups + follow doctor’s advice.</p>`
  },
  { title:"Warning Signs & First Aid (BEFAST)",
    brief:"Recognize and act fast.",
    html: `
      <h2>BEFAST: Warning Signs</h2>
      <ul>
        <li><b>B</b>alance problems</li>
        <li><b>E</b>yes: vision loss/double vision</li>
        <li><b>F</b>ace drooping</li>
        <li><b>A</b>rm weakness</li>
        <li><b>S</b>peech difficulty</li>
        <li><b>T</b>ime to call 1669 immediately</li>
      </ul>
      <p>Quick test: smile / raise both arms / say a short sentence. If abnormal → call an ambulance.</p>`
  },
  { title:"Treatment & Recovery",
    brief:"What hospitals do and how to recover.",
    html: `
      <h2>Treatment & Recovery</h2>
      <p>CT/MRI to see block vs bleed → different treatments (clot-buster vs stop bleeding).</p>
      <p>Rehab: physical, speech, and occupational therapy; healthy food, rest, and family encouragement.</p>
      <p>Prevent another stroke: control BP/sugar/cholesterol, exercise, keep appointments.</p>`
  }
];

function buildLearn(){
  const grid = document.getElementById("learnGrid");
  const modal = document.getElementById("learnModal");
  const body  = document.getElementById("learnBody");
  const close = document.getElementById("learnClose");

  grid.innerHTML = "";
  SLIDES.forEach((s, i)=>{
    const c = document.createElement("div");
    c.className = "card";
    c.innerHTML = `<h3>Slide ${i+1}: ${s.title}</h3><p>${s.brief}</p>`;
    c.onclick = ()=>{ body.innerHTML = s.html; modal.classList.add("show"); };
    grid.appendChild(c);
  });

  close.onclick = ()=> modal.classList.remove("show");
  modal.addEventListener("click", (e)=>{ if(e.target===modal) modal.classList.remove("show"); });
}
