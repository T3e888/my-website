// ==== SIDEBAR JS (Universal, top of every JS file) ====
document.addEventListener("DOMContentLoaded", () => {
  // Login guard
  if (!localStorage.getItem("currentUser")) {
    window.location.href = "login.html";
    return;
  }
  const toggleBtn = document.getElementById("menu-toggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  const closeBtn = document.getElementById("close-sidebar");
  const menuItems = document.querySelectorAll("#sidebar .menu-item");
  const logout = document.getElementById("logout-link");

  toggleBtn.addEventListener("click", () => {
    sidebar.classList.add("open");
    overlay.classList.add("active");
  });
  function closeSidebar() {
    sidebar.classList.remove("open");
    overlay.classList.remove("active");
  }
  closeBtn.addEventListener("click", closeSidebar);
  overlay.addEventListener("click", closeSidebar);
  menuItems.forEach(item => {
    item.addEventListener("click", (e) => {
      if (item === logout) {
         e.preventDefault();
  // ลบแค่ session key
         localStorage.removeItem('currentUser');
         window.location.href = 'login.html';
       } else {
         closeSidebar();
       }
    });
  });

  // ==== END SIDEBAR JS ====

  // ======= Quiz Zone Logic =======
  const user = localStorage.getItem("currentUser");
  const levels = 10;
  const quizPerDay = 3;
  const dailyInfo = document.getElementById("dailyInfo");
  const levelList = document.querySelector(".levels");
  const modal = document.getElementById("quizModal");

  // State: <user>_mission (Boolean[levels]), <user>_quizDate, <user>_quizCount
  let completed = JSON.parse(localStorage.getItem(user + "_mission") || "[]");
  if (completed.length !== levels) completed = Array(levels).fill(false);
  let quizDate = localStorage.getItem(user + "_quizDate") || "";
  let quizCount = parseInt(localStorage.getItem(user + "_quizCount") || "0");

  // Reset count if day changed
  const today = new Date().toISOString().slice(0,10);
  if (quizDate !== today) {
    quizDate = today; quizCount = 0;
    localStorage.setItem(user + "_quizDate", quizDate);
    localStorage.setItem(user + "_quizCount", quizCount);
  }

  updateUI();

  function updateUI() {
    dailyInfo.textContent = `${quizCount} / ${quizPerDay} quizzes today`;
    // Build timeline
    levelList.innerHTML = "";
    let firstLockedIdx = completed.findIndex(x=>!x);
    if (firstLockedIdx === -1) firstLockedIdx = levels; // all completed
    for (let i=0;i<levels;++i) {
      let li = document.createElement("li");
      li.className = "level";
      if (completed[i]) li.classList.add("completed");
      else if (i === firstLockedIdx && quizCount < quizPerDay) li.classList.add("active");
      else li.classList.add("locked");
      li.innerHTML = `<div class="level-circle">${i+1}</div>
        <div class="level-label">Level ${i+1}</div>`;
      if (li.classList.contains("active")) {
        li.onclick = () => startQuiz(i);
      }
      levelList.appendChild(li);
    }
  }

  function showModal(msg, cb) {
    modal.innerHTML = `<div class="modal-content">${msg}<br>
      <button class="modal-close">OK</button></div>`;
    modal.classList.add("active");
    modal.querySelector(".modal-close").onclick = () => {
      modal.classList.remove("active");
      if(cb) cb();
    };
  }

  // === Sample Stroke Quiz Data ===
  const quizBank = [
    {
      q: "ข้อใดคืออาการเบื้องต้นของโรคหลอดเลือดสมอง?",
      opts: ["ปากเบี้ยวพูดไม่ชัด", "ปวดหัว", "เจ็บท้อง", "ปวดหลัง"],
      answer: 0
    },
    {
      q: "ถ้าพบคนหมดสติ ควรทำอย่างไร?",
      opts: ["โทร 1669", "ให้น้ำ", "จับให้นอนตะแคง", "นวดหลัง"],
      answer: 0
    },
    {
      q: "ตัวเลขฉุกเฉินช่วยชีวิตในไทยคืออะไร?",
      opts: ["1669", "1193", "191", "1234"],
      answer: 0
    },
    {
      q: "อาการใดที่ควรสงสัยว่าเกิด Stroke?",
      opts: ["พูดไม่ชัด", "ชาตามใบหน้า", "อ่อนแรงแขนขา", "ทุกข้อ"],
      answer: 3
    },
    {
      q: "วิธีป้องกันโรคหลอดเลือดสมองข้อใดถูกต้อง?",
      opts: ["งดสูบบุหรี่", "ออกกำลังกาย", "ควบคุมความดัน", "ทุกข้อ"],
      answer: 3
    }
  ];

  function getRandomQuizSet() {
    // Pick 3 unique questions
    let idx = [...Array(quizBank.length).keys()].sort(()=>Math.random()-0.5).slice(0,3);
    return idx.map(i=>quizBank[i]);
  }

  function startQuiz(idx) {
    if (quizCount >= quizPerDay) {
      showModal("You've reached today's limit – come back tomorrow!");
      return;
    }
    let quizSet = getRandomQuizSet();
    let curr = 0, correct = 0, userAns = [];

    function renderQ() {
      let q = quizSet[curr];
      modal.innerHTML = `<div class="modal-content">
        <div class="quiz-q">Q${curr+1}/3: ${q.q}</div>
        <div class="quiz-opts">
          ${q.opts.map((op,i)=>
            `<div class="quiz-opt" data-idx="${i}">${op}</div>`).join("")}
        </div>
        <div class="quiz-actions">
          ${curr>0?'<button class="modal-close">Back</button>':''}
          <button id="submitAns">Submit</button>
        </div>
      </div>`;
      modal.classList.add("active");
      let selected = -1;
      document.querySelectorAll(".quiz-opt").forEach(opt=>{
        opt.onclick = ()=> {
          document.querySelectorAll(".quiz-opt").forEach(o=>o.classList.remove("selected"));
          opt.classList.add("selected"); selected = parseInt(opt.dataset.idx);
        };
      });
      document.getElementById("submitAns").onclick = ()=>{
        if (selected === -1) return;
        userAns[curr] = selected;
        if (selected === q.answer) correct++;
        if (curr < 2) { curr++; renderQ(); }
        else {
          if (correct===3) {
            completed[idx]=true;
            quizCount++;
            localStorage.setItem(user + "_mission", JSON.stringify(completed));
            localStorage.setItem(user + "_quizDate", today);
            localStorage.setItem(user + "_quizCount", quizCount);
            updateUI();
            showModal("ยอดเยี่ยม! คุณผ่าน Level นี้แล้ว");
          } else {
            showModal(`ต้องตอบถูกทั้งหมด! คุณได้ ${correct}/3<br>โปรดลองอีกครั้ง`);
          }
        }
      };
      if (curr>0) {
        document.querySelector(".modal-close").onclick = ()=>{
          curr--; renderQ();
        };
      }
    }
    renderQ();
  }
});
