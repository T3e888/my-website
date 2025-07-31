document.addEventListener("DOMContentLoaded", function() {
  // Sidebar toggle
  document.querySelectorAll(".openbtn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelector(".sidebar").classList.toggle("open");
    });
  });

  // Show username
  const user = localStorage.getItem("token");
  if (user) {
    const disp = document.getElementById("usernameDisplay");
    if (disp) disp.textContent = user;
  }

  // Logout
  const logoutLink = document.getElementById("logoutLink");
  if (logoutLink) {
    logoutLink.addEventListener("click", e => {
      e.preventDefault();
      localStorage.removeItem("token");
      window.location.href = "login.html";
    });
  }

  // Close popup
  document.querySelectorAll(".popup").forEach(p => {
    const closeBtn = p.querySelector("button");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        p.classList.remove("active");
      });
    }
  });

  // Protected pages redirect to login
  const path = window.location.pathname.split("/").pop();
  const protectedPages = ["index.html", "scan.html", "mission.html"];
  if (protectedPages.includes(path) && !user) {
    window.location.href = `login.html?redirect=${path}`;
  }

  // ====== index.html: render collection grid ======
  if (path === "index.html") {
    const allCards = ["card1", "card2", "card3", "card4"]; // เพิ่มตามจริง
    const key = user + "_cards";
    const unlocked = JSON.parse(localStorage.getItem(key) || "{}");
    const container = document.getElementById("collection");
    container.innerHTML = "";
    allCards.forEach(card => {
      const slot = document.createElement("div");
      slot.className = "card-slot" + (unlocked[card] ? "" : " locked");
      const img = document.createElement("img");
      img.src = `assets/cards/${card}.png`;
      slot.appendChild(img);
      container.appendChild(slot);
    });
  }

  // ====== scan.html: QR scanning ======
  if (path === "scan.html") {
    const allCards = ["card1", "card2", "card3", "card4"];
    const key = user + "_cards";
    let unlocked = JSON.parse(localStorage.getItem(key) || "{}");
    const video = document.getElementById("video");
    const cameraBtn = document.getElementById("cameraBtn");
    const stopBtn = document.getElementById("stopBtn");
    const fileInput = document.getElementById("fileInput");
    let stream, interval, detector;

    function handleCode(code) {
      clearInterval(interval);
      stream.getTracks().forEach(t => t.stop());
      video.style.display = "none";
      stopBtn.style.display = "none";
      cameraBtn.style.display = "inline-block";
      if (!allCards.includes(code)) return alert("Invalid QR");
      unlocked[code] = (unlocked[code] || 0) + 1;
      localStorage.setItem(key, JSON.stringify(unlocked));
      document.getElementById("popupTitle").textContent = unlocked[code] === 1 ? "New Card Unlocked!" : "Card Already Collected";
      document.getElementById("popupCardImg").src = `assets/cards/${code}.png`;
      document.getElementById("popupCardName").textContent = code;
      document.querySelector(".popup").classList.add("active");
    }

    cameraBtn.addEventListener("click", async () => {
      if (!("BarcodeDetector" in window)) return alert("Browser not supported");
      detector = new BarcodeDetector({ formats: ["qr_code"] });
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      } catch {
        return alert("Cannot access camera");
      }
      video.srcObject = stream;
      video.style.display = "block";
      stopBtn.style.display = "inline-block";
      cameraBtn.style.display = "none";

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      interval = setInterval(async () => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          const codes = await detector.detect(canvas);
          if (codes.length) handleCode(codes[0].rawValue);
        }
      }, 500);
    });

    stopBtn.addEventListener("click", () => {
      clearInterval(interval);
      stream.getTracks().forEach(t => t.stop());
      video.style.display = "none";
      stopBtn.style.display = "none";
      cameraBtn.style.display = "inline-block";
    });

    fileInput.addEventListener("change", e => {
      const file = e.target.files[0];
      if (!file || !("BarcodeDetector" in window)) return alert("Cannot scan");
      detector = new BarcodeDetector({ formats: ["qr_code"] });
      const img = new Image();
      img.onload = async () => {
        const codes = await detector.detect(img);
        codes.length ? handleCode(codes[0].rawValue) : alert("No QR found");
      };
      const reader = new FileReader();
      reader.onload = e2 => (img.src = e2.target.result);
      reader.readAsDataURL(file);
    });
  }

  // ====== mission.html: daily quiz ======
  if (path === "mission.html") {
    const allCards = ["card1", "card2", "card3", "card4"];
    const key = user + "_cards";
    let unlocked = JSON.parse(localStorage.getItem(key) || "{}");
    const quizData = {
      question: "F ใน FAST ย่อมาจากอะไร?",
      options: ["Finger", "Face", "Foot", "Food"],
      answerIndex: 1
    };
    const tKey = user + "_lastQuizTime";
    const sKey = user + "_lastQuizStatus";
    const last = localStorage.getItem(tKey);
    const status = localStorage.getItem(sKey);
    const quizSection = document.getElementById("quiz-section");
    const waitSection = document.getElementById("wait-section");
    const waitMsg = document.getElementById("waitMsg");

    // all unlocked?
    if (allCards.every(c => unlocked[c])) {
      quizSection.style.display = "none";
      waitSection.style.display = "block";
      waitMsg.textContent = "คุณสะสมครบแล้ว!";
      return;
    }
    // within 24h?
    if (last && Date.now() - parseInt(last) < 86400000) {
      quizSection.style.display = "none";
      waitSection.style.display = "block";
      waitMsg.textContent = status === "correct"
        ? "ทำแบบทดสอบแล้ว โปรดกลับมาใหม่พรุ่งนี้."
        : "ตอบผิดวันนี้ ลองใหม่หลัง 24 ชม.";
      return;
    }

    // render question
    document.getElementById("question-text").textContent = quizData.question;
    const opts = document.getElementById("optionsContainer");
    opts.innerHTML = "";
    quizData.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = opt;
      btn.onclick = () => {
        document.querySelectorAll(".option-btn").forEach(x => (x.disabled = true));
        const correct = i === quizData.answerIndex;
        btn.classList.add(correct ? "correct" : "wrong");
        localStorage.setItem(tKey, Date.now().toString());
        localStorage.setItem(sKey, correct ? "correct" : "wrong");
        if (correct) {
          const remaining = allCards.filter(c => !unlocked[c]);
          const newCard = remaining[Math.floor(Math.random() * remaining.length)];
          unlocked[newCard] = 1;
          localStorage.setItem(key, JSON.stringify(unlocked));
          document.getElementById("popupCardImg").src = `assets/cards/${newCard}.png`;
          document.getElementById("popupCardName").textContent = newCard;
          document.querySelector(".popup").classList.add("active");
        } else {
          const msg = document.getElementById("resultMsg");
          msg.style.display = "block";
          msg.textContent = "ตอบไม่ถูก ต้องรอ 24 ชม.";
        }
      };
      opts.appendChild(btn);
    });
  }
});
