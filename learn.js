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
  { title:"ความรู้พื้นฐานเกี่ยวกับโรคหลอดเลือดสมอง (Stroke)",
    brief:"Stroke คืออะไร และทำไมเวลาถึงสำคัญ",
    html: `
      <h2>ความรู้พื้นฐานเกี่ยวกับโรคหลอดเลือดสมอง (Stroke)</h2>
      <p><b>Stroke</b> = ภาวะที่สมองขาดเลือดหรือมีเลือดออก → ทำให้สมองทำงานผิดปกติแบบเฉียบพลัน ถือเป็นภาวะฉุกเฉินทางการแพทย์</p>
      <ul>
        <li><b>ชนิดตีบ/อุดตัน (Ischemic)</b> (≈80–85%): หลอดเลือดสมองถูกอุดตัน → เลือดไปเลี้ยงสมองน้อยลง</li>
        <li><b>ชนิดแตก (Hemorrhagic)</b> (≈15–20%): หลอดเลือดสมองแตก → เลือดออกในสมอง</li>
      </ul>
      <p><b>TIA</b> = อาการเหมือน Stroke แต่หายไปใน 24 ชั่วโมง → ถือเป็นสัญญาณเตือน ต้องรีบพบแพทย์</p>
      <p>เลือดไปเลี้ยงสมองมาจากหลอดเลือด Carotid และ Vertebral หากขาดเลือด สมองจะเริ่มเสียหายใน ~4–5 นาที</p>
      <p><i>สรุป:</i> เวลา = สมอง รีบโทรขอความช่วยเหลือฉุกเฉินทันที</p>`
  },
  { title:"สาเหตุและปัจจัยเสี่ยง",
    brief:"การอุดตัน การแตก และสิ่งที่เพิ่มความเสี่ยง",
    html: `
      <h2>สาเหตุและปัจจัยเสี่ยง</h2>
      <p><b>การอุดตัน</b>: ลิ่มเลือดที่สมอง/คอ หรือมาจากหัวใจ (เช่น ภาวะหัวใจเต้นผิดจังหวะ atrial fibrillation)</p>
      <p><b>การแตก</b>: ผนังหลอดเลือดอ่อนแอ จากความดันโลหิตสูงเรื้อรัง หรือหลอดเลือดโป่งพอง (aneurysm)</p>
      <p><b>ปัจจัยเสี่ยงที่ควบคุมได้</b>: ความดันสูง, สูบบุหรี่, เบาหวาน, ไขมันสูง, ดื่มแอลกอฮอล์, โรคอ้วน/ไม่ออกกำลังกาย, ความเครียด/นอนน้อย</p>
      <p><b>ปัจจัยเสี่ยงที่ควบคุมไม่ได้</b>: อายุ, ประวัติครอบครัว, เพศ</p>
      <p>ควบคุมความดัน/น้ำตาล/ไขมัน, เลิกบุหรี่, ออกกำลังกาย → ลดความเสี่ยงได้</p>`
  },
  { title:"การป้องกันและการดูแลตัวเอง",
    brief:"พฤติกรรมประจำวันเพื่อปกป้องสมอง",
    html: `
      <h2>การป้องกันและการดูแลตัวเอง</h2>
      <p>กินอาหารที่ดีต่อหัวใจ, ออกกำลังกายอย่างน้อย 150 นาที/สัปดาห์, เลิกสูบบุหรี่, จำกัดการดื่มแอลกอฮอล์</p>
      <p>ควบคุมน้ำหนักและรอบเอว, นอน 7–9 ชั่วโมง, จัดการความเครียด, ดื่มน้ำเพียงพอ</p>
      <p>ตรวจสุขภาพเป็นประจำ + ปฏิบัติตามคำแนะนำแพทย์</p>`
  },
  { title:"สัญญาณเตือนและการปฐมพยาบาล (BEFAST)",
    brief:"รู้จักอาการและลงมืออย่างรวดเร็ว",
    html: `
      <h2>BEFAST: สัญญาณเตือน</h2>
      <ul>
        <li><b>B</b>alance: การทรงตัวผิดปกติ</li>
        <li><b>E</b>yes: ตามัว/มองเห็นซ้อน</li>
        <li><b>F</b>ace: หน้าเบี้ยว</li>
        <li><b>A</b>rm: แขนขาอ่อนแรง</li>
        <li><b>S</b>peech: พูดไม่ชัด/พูดไม่ได้</li>
        <li><b>T</b>Time: รีบโทร 1669 ทันที</li>
      </ul>
      <p>การทดสอบง่าย ๆ: ให้ยิ้ม / ยกแขนทั้งสองข้าง / พูดประโยคสั้น ๆ หากผิดปกติ → โทรเรียกรถพยาบาลทันที</p>`
  },
  { title:"การรักษาและการฟื้นฟู",
    brief:"โรงพยาบาลทำอะไรและการฟื้นตัวหลังป่วย",
    html: `
      <h2>การรักษาและการฟื้นฟู</h2>
      <p>ตรวจ CT/MRI เพื่อแยกภาวะอุดตันหรือแตก → วิธีรักษาต่างกัน (ยาละลายลิ่มเลือด vs หยุดเลือด)</p>
      <p>การฟื้นฟู: กายภาพบำบัด, ฝึกพูด, ฝึกอาชีพ; อาหารที่ดี, การพักผ่อน, กำลังใจจากครอบครัว</p>
      <p>ป้องกัน Stroke ซ้ำ: ควบคุมความดัน/น้ำตาล/ไขมัน, ออกกำลังกาย, พบแพทย์ตามนัด</p>`
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
