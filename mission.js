firebase.auth().onAuthStateChanged(function(user) {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // Sidebar logic
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

  logout.addEventListener("click", function(e) {
    e.preventDefault();
    firebase.auth().signOut().then(() => {
      window.location.href = "login.html";
    });
  });
  menuItems.forEach(item => {
    if (item !== logout) {
      item.addEventListener("click", closeSidebar);
    }
  });

  // --- Quiz Zone Logic ---
  const userKey = user.email.replace(/[^a-zA-Z0-9]/g, '_');
  const levels = 10;
  const quizPerDay = 3;
  const dailyInfo = document.getElementById("dailyInfo");
  const levelList = document.querySelector(".levels");
  const modal = document.getElementById("quizModal");

  let completed = JSON.parse(localStorage.getItem(userKey + "_mission") || "[]");
  if (completed.length !== levels) completed = Array(levels).fill(false);
  let quizDate = localStorage.getItem(userKey + "_quizDate") || "";
  let quizCount = parseInt(localStorage.getItem(userKey + "_quizCount") || "0");

  const today = new Date().toISOString().slice(0,10);
  if (quizDate !== today) {
    quizDate = today; quizCount = 0;
    localStorage.setItem(userKey + "_quizDate", quizDate);
    localStorage.setItem(userKey + "_quizCount", quizCount);
  }

  updateUI();

  function updateUI() {
    dailyInfo.textContent = `${quizCount} / ${quizPerDay} quizzes today`;
    levelList.innerHTML = "";
    let firstLockedIdx = completed.findIndex(x=>!x);
    if (firstLockedIdx === -1) firstLockedIdx = levels;
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

  // === Sample Quiz Data ===
  const quizBank = [
    {
      q: "Which of the following is an early symptom of stroke?",
      opts: ["Face drooping, slurred speech", "Headache", "Stomach pain", "Back pain"],
      answer: 0
    },
    {
      q: "What should you do if you find someone unconscious?",
      opts: ["Call 1669", "Give water", "Lay on side", "Massage back"],
      answer: 0
    },
    {
      q: "What is the emergency number in Thailand?",
      opts: ["1669", "1193", "191", "1234"],
      answer: 0
    },
    {
      q: "Which sign suggests possible stroke?",
      opts: ["Slurred speech", "Facial numbness", "Weak limbs", "All of the above"],
      answer: 3
    },
    {
      q: "Which is a correct way to prevent stroke?",
      opts: ["No smoking", "Exercise", "Control BP", "All of the above"],
      answer: 3
    }
  ];

  function getRandomQuizSet() {
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
            localStorage.setItem(userKey + "_mission", JSON.stringify(completed));
            localStorage.setItem(userKey + "_quizDate", today);
            localStorage.setItem(userKey + "_quizCount", quizCount);
            updateUI();
            showModal("Excellent! You completed this Level.");
          } else {
            showModal(`You need to get all answers correct! You got ${correct}/3<br>Please try again.`);
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
