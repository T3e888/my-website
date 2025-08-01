// ✅ ตรวจสอบล็อกอิน
if (!localStorage.getItem('token') && !window.location.href.includes('login.html') && !window.location.href.includes('register.html')) {
  window.location.href = 'login.html';
}

// ✅ Toggle รหัสผ่าน
function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  input.type = input.type === 'password' ? 'text' : 'password';
}

// ✅ Modal แจ้งเตือน
function showModal(msg, delay = 1500) {
  const modal = document.getElementById('modal');
  const modalMsg = document.getElementById('modalMsg');
  modalMsg.textContent = msg;
  modal.style.display = 'flex';
  setTimeout(() => modal.style.display = 'none', delay);
}

// ✅ ล็อกอิน
function login() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const users = JSON.parse(localStorage.getItem('users') || '{}');
  if (users[email] === password) {
    localStorage.setItem('token', email);
    showModal('เข้าสู่ระบบสำเร็จ!');
    setTimeout(() => window.location.href = 'index.html', 1000);
  } else {
    showModal('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  }
}

// ✅ สมัครสมาชิก
function register() {
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const users = JSON.parse(localStorage.getItem('users') || '{}');
  if (users[email]) return showModal('อีเมลนี้ถูกใช้ไปแล้ว');
  users[email] = password;
  localStorage.setItem('users', JSON.stringify(users));
  showModal('สมัครสมาชิกสำเร็จ!');
  setTimeout(() => window.location.href = 'login.html', 1000);
}

// ✅ แสดงชื่อผู้ใช้
const token = localStorage.getItem('token');
if (token && document.getElementById('usernameDisplay')) {
  document.getElementById('usernameDisplay').textContent = token;
}

// ✅ Logout
const logoutBtn = document.getElementById('logoutLink');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    showModal('ออกจากระบบแล้ว');
    setTimeout(() => window.location.href = 'login.html', 1000);
  });
}

// ✅ การ์ดทั้งหมด
const allCards = Array.from({ length: 25 }, (_, i) => `card${i + 1}`);
if (document.getElementById('collection')) {
  const unlocked = JSON.parse(localStorage.getItem(token + '_cards') || '{}');
  const container = document.getElementById('collection');
  container.innerHTML = '';
  allCards.forEach(card => {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card-slot';
    const img = document.createElement('img');
    img.src = `assets/cards/${card}.png`;
    img.classList.add('card-img');
    if (!unlocked[card]) {
      img.style.filter = 'brightness(0.3) grayscale(100%)';
    }
    cardDiv.appendChild(img);
    container.appendChild(cardDiv);
  });
}

// ✅ QR Code Scanner
if (document.getElementById('cameraBtn')) {
  let video = document.getElementById('video');
  let cameraBtn = document.getElementById('cameraBtn');
  let stopBtn = document.getElementById('stopBtn');
  let fileInput = document.getElementById('fileInput');
  let stream, scanInterval, detector;

  async function handleQRCode(value) {
    stopCamera();
    const key = allCards.includes(value) ? value : null;
    if (!key) return showModal('QR ไม่ถูกต้อง');

    const userKey = token + '_cards';
    let unlocked = JSON.parse(localStorage.getItem(userKey) || '{}');
    let title = 'New Card Unlocked!';
    if (unlocked[key]) {
      unlocked[key]++;
      title = 'ได้การ์ดซ้ำ!';
    } else {
      unlocked[key] = 1;
    }
    localStorage.setItem(userKey, JSON.stringify(unlocked));
    document.getElementById('popupTitle').innerText = title;
    document.getElementById('popupCardImg').src = `assets/cards/${key}.png`;
    document.getElementById('popupCardName').innerText = key;
    document.getElementById('cardPopup').style.display = 'flex';
  }

  function stopCamera() {
    if (scanInterval) clearInterval(scanInterval);
    if (stream) stream.getTracks().forEach(t => t.stop());
    video.style.display = 'none';
    stopBtn.style.display = 'none';
    cameraBtn.style.display = 'inline-block';
  }

  cameraBtn.addEventListener('click', async () => {
    if (!('BarcodeDetector' in window)) return alert('Browser ไม่รองรับ');
    detector = new BarcodeDetector({ formats: ['qr_code'] });
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
    video.style.display = 'block';
    cameraBtn.style.display = 'none';
    stopBtn.style.display = 'inline-block';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    scanInterval = setInterval(async () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const codes = await detector.detect(canvas);
        if (codes.length) {
          handleQRCode(codes[0].rawValue);
        }
      }
    }, 500);
  });

  stopBtn.addEventListener('click', stopCamera);
  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file || !('BarcodeDetector' in window)) return;
    detector = new BarcodeDetector({ formats: ['qr_code'] });
    const img = new Image();
    img.onload = async () => {
      const codes = await detector.detect(img);
      if (codes.length) handleQRCode(codes[0].rawValue);
      else showModal('ไม่พบ QR');
    };
    const reader = new FileReader();
    reader.onload = e => img.src = e.target.result;
    reader.readAsDataURL(file);
  });

  document.getElementById('popupClose').onclick = () => {
    document.getElementById('cardPopup').style.display = 'none';
  };
}

// ✅ ภารกิจรายวัน
if (document.getElementById('missionBox')) {
  const missionBox = document.getElementById('missionBox');
  const timerDiv = document.getElementById('timer');
  const key = 'last_mission_time_' + token;
  const last = localStorage.getItem(key);
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  if (!last || now - Number(last) >= dayMs) {
    localStorage.setItem(key, now);
    missionBox.innerHTML = `<p><strong>ภารกิจวันนี้:</strong> ตอบคำถามให้ถูกต้อง!</p>`;
  } else {
    const remaining = dayMs - (now - Number(last));
    const h = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    timerDiv.innerText = `กรุณารออีก ${h} ชม. ${m} นาที ${s} วินาที เพื่อรีเฟรชภารกิจ`;
  }
}    const cardParam = getQueryParam('card');
    const onLoginPage = window.location.href.includes('login.html');
    const onRegisterPage = window.location.href.includes('register.html');
    
    // Redirect to login page if not logged in (unless on login or register page)
    if (!currentUser && !onLoginPage && !onRegisterPage) {
        if (cardParam) {
            // If a card unlock link was opened while not logged in
            showModal('กรุณาเข้าสู่ระบบก่อนปลดล็อกการ์ด', function() {
                window.location = 'login.html';
            });
        } else {
            window.location = 'login.html';
        }
        return;
    }
    
    // Load user data from localStorage
    let usersData = JSON.parse(localStorage.getItem('users') || '{}');
    let userData = null;
    if (currentUser) {
        userData = usersData[currentUser] || {};
        if (!userData.unlocked) {
            userData.unlocked = [];
        }
    }
    
    // Function to unlock a card for the logged-in user
    function unlockCard(cardId) {
        if (!currentUser || !userData) return false;
        if (!userData.unlocked.includes(cardId)) {
            userData.unlocked.push(cardId);
            usersData[currentUser] = userData;
            localStorage.setItem('users', JSON.stringify(usersData));
            return true;
        }
        return false;
    }
    
    // If URL has card param and user is logged in, unlock that card
    if (cardParam && currentUser) {
        const newUnlocked = unlockCard(cardParam);
        const cardNumber = cardParam.replace('card', '');
        if (window.location.href.includes('scan.html')) {
            // On scan page: show modal then redirect to index
            if (newUnlocked) {
                showModal('การ์ด ' + cardNumber + ' ถูกปลดล็อกแล้ว!', function() {
                    window.location = 'index.html';
                });
            } else {
                showModal('การ์ด ' + cardNumber + ' ได้ปลดล็อกไปแล้ว', function() {
                    window.location = 'index.html';
                });
            }
        } else {
            if (newUnlocked) {
                showModal('การ์ด ' + cardNumber + ' ถูกปลดล็อกแล้ว!');
            } else {
                showModal('การ์ด ' + cardNumber + ' ได้ปลดล็อกไปแล้ว');
            }
        }
    }
    
    // Display logged-in username in UI
    const userDisplayEl = document.getElementById('usernameDisplay');
    if (userDisplayEl && currentUser) {
        userDisplayEl.textContent = currentUser;
    }
    
    // Toggle password visibility in forms
    document.querySelectorAll('.toggle-password').forEach(function(toggle) {
        toggle.addEventListener('click', function() {
            let targetInput = null;
            const selector = toggle.getAttribute('data-target') || toggle.getAttribute('toggle');
            if (selector) {
                targetInput = document.querySelector(selector);
            }
            if (!targetInput) {
                targetInput = toggle.previousElementSibling;
            }
            if (targetInput && targetInput.type === 'password') {
                targetInput.type = 'text';
            } else if (targetInput && targetInput.type === 'text') {
                targetInput.type = 'password';
            }
        });
    });
    
    // Logout button action
    const logoutBtn = document.getElementById('logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            localStorage.removeItem('currentUser');
            showModal('ออกจากระบบสำเร็จ', function() {
                window.location = 'login.html';
            });
        });
    }
    
    // Login form submission
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const usernameField = document.getElementById('username');
            const passwordField = document.getElementById('password');
            const username = usernameField ? usernameField.value.trim() : '';
            const password = passwordField ? passwordField.value : '';
            if (!username || !password) {
                showModal('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
                return;
            }
            const users = JSON.parse(localStorage.getItem('users') || '{}');
            if (users[username] && users[username].password === password) {
                localStorage.setItem('currentUser', username);
                showModal('เข้าสู่ระบบสำเร็จ!', function() {
                    window.location = 'index.html';
                });
            } else {
                showModal('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
            }
        });
    }
    
    // Register form submission
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const usernameField = document.getElementById('regUsername') || document.getElementById('username');
            const passwordField = document.getElementById('regPassword') || document.getElementById('password');
            const username = usernameField ? usernameField.value.trim() : '';
            const password = passwordField ? passwordField.value : '';
            if (!username || !password) {
                showModal('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
                return;
            }
            let users = JSON.parse(localStorage.getItem('users') || '{}');
            if (users[username]) {
                showModal('ชื่อผู้ใช้นี้มีอยู่แล้ว');
            } else {
                users[username] = {
                    password: password,
                    unlocked: []
                };
                localStorage.setItem('users', JSON.stringify(users));
                showModal('ลงทะเบียนสำเร็จ! กรุณาเข้าสู่ระบบ', function() {
                    window.location = 'login.html';
                });
            }
        });
    }
    
    // Index page: display all cards
    if (window.location.href.includes('index.html') && currentUser) {
        const cardGrid = document.getElementById('cardGrid');
        if (cardGrid) {
            for (let i = 1; i <= 25; i++) {
                const cardId = 'card' + i;
                const img = document.createElement('img');
                img.src = 'assets/cards/' + cardId + '.png';
                img.alt = cardId;
                img.classList.add('card');
                if (!userData.unlocked.includes(cardId)) {
                    img.classList.add('locked');
                }
                cardGrid.appendChild(img);
            }
        }
    }
    
    // Mission page: question and answer logic
    if (window.location.href.includes('mission.html') && currentUser) {
        const questions = [
            { q: '2 + 2 เท่ากับเท่าไหร่?', a: '4', card: 'card21' },
            { q: 'สีของท้องฟ้าในวันที่อากาศแจ่มใสคือสีอะไร?', a: 'สีฟ้า', card: 'card22' }
        ];
        const questionTextEl = document.getElementById('questionText') || document.getElementById('question');
        const answerInput = document.getElementById('answerInput') || document.getElementById('answer');
        const submitBtn = document.getElementById('submitAnswer') || document.getElementById('submit');
        
        let currentQuestion = null;
        function loadQuestion() {
            if (questions.length === 0) return;
            currentQuestion = questions[Math.floor(Math.random() * questions.length)];
            if (questionTextEl) {
                questionTextEl.textContent = currentQuestion.q;
            }
            if (answerInput) {
                answerInput.value = '';
                answerInput.disabled = false;
                answerInput.style.display = '';
            }
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.style.display = '';
            }
        }
        
        // Check if user is in 24h cooldown
        if (userData.missionLockTime) {
            const now = Date.now();
            if (now < userData.missionLockTime) {
                // Still locked
                if (answerInput) answerInput.style.display = 'none';
                if (submitBtn) submitBtn.style.display = 'none';
                // Display initial countdown immediately
                let diff = userData.missionLockTime - now;
                let totalSec = Math.floor(diff / 1000);
                let hours = Math.floor(totalSec / 3600);
                let minutes = Math.floor((totalSec % 3600) / 60);
                let seconds = totalSec % 60;
                let hh = hours.toString().padStart(2, '0');
                let mm = minutes.toString().padStart(2, '0');
                let ss = seconds.toString().padStart(2, '0');
                if (questionTextEl) {
                    questionTextEl.textContent = 'กรุณารออีก ' + hh + ':' + mm + ':' + ss + ' ก่อนเล่นได้อีกครั้ง';
                }
                // Update countdown every second
                const countdownInterval = setInterval(function() {
                    diff = userData.missionLockTime - Date.now();
                    if (diff <= 0) {
                        clearInterval(countdownInterval);
                        delete userData.missionLockTime;
                        usersData[currentUser] = userData;
                        localStorage.setItem('users', JSON.stringify(usersData));
                        loadQuestion();
                        return;
                    }
                    totalSec = Math.floor(diff / 1000);
                    hours = Math.floor(totalSec / 3600);
                    minutes = Math.floor((totalSec % 3600) / 60);
                    seconds = totalSec % 60;
                    hh = hours.toString().padStart(2, '0');
                    mm = minutes.toString().padStart(2, '0');
                    ss = seconds.toString().padStart(2, '0');
                    if (questionTextEl) {
                        questionTextEl.textContent = 'กรุณารออีก ' + hh + ':' + mm + ':' + ss + ' ก่อนเล่นได้อีกครั้ง';
                    }
                }, 1000);
            } else {
                // Lock period passed
                delete userData.missionLockTime;
                usersData[currentUser] = userData;
                localStorage.setItem('users', JSON.stringify(usersData));
                loadQuestion();
            }
        } else {
            // No lock, load a new question
            loadQuestion();
        }
        
        // Handle answer submission
        if (submitBtn) {
            submitBtn.addEventListener('click', function() {
                if (!currentQuestion || !answerInput) return;
                const answer = answerInput.value.trim();
                if (!answer) return;
                let correct = false;
                if (typeof currentQuestion.a === 'string') {
                    correct = currentQuestion.a.toLowerCase() === answer.toLowerCase();
                } else if (Array.isArray(currentQuestion.a)) {
                    // In case an array of acceptable answers is provided
                    correct = currentQuestion.a.map(x => x.toLowerCase()).includes(answer.toLowerCase());
                }
                if (correct) {
                    let msg = 'ตอบถูกต้อง!';
                    if (currentQuestion.card) {
                        const newUnlock = unlockCard(currentQuestion.card);
                        const cardNum = currentQuestion.card.replace('card', '');
                        if (newUnlock) {
                            msg += ' ปลดล็อกการ์ด ' + cardNum + ' แล้ว!';
                        } else {
                            msg += ' แต่การ์ด ' + cardNum + ' ได้ปลดล็อกไปแล้ว';
                        }
                    }
                    showModal(msg);
                    // Disable further input after success
                    if (answerInput) answerInput.disabled = true;
                    if (submitBtn) submitBtn.disabled = true;
                } else {
                    // Wrong answer: start 24h cooldown
                    const lockUntil = Date.now() + 24 * 60 * 60 * 1000;
                    userData.missionLockTime = lockUntil;
                    usersData[currentUser] = userData;
                    localStorage.setItem('users', JSON.stringify(usersData));
                    // Set initial countdown display
                    let diff = lockUntil - Date.now();
                    let totalSec = Math.floor(diff / 1000);
                    let hours = Math.floor(totalSec / 3600);
                    let minutes = Math.floor((totalSec % 3600) / 60);
                    let seconds = totalSec % 60;
                    let hh = hours.toString().padStart(2, '0');
                    let mm = minutes.toString().padStart(2, '0');
                    let ss = seconds.toString().padStart(2, '0');
                    if (questionTextEl) {
                        questionTextEl.textContent = 'กรุณารออีก ' + hh + ':' + mm + ':' + ss + ' ก่อนเล่นได้อีกครั้ง';
                    }
                    if (answerInput) answerInput.style.display = 'none';
                    if (submitBtn) submitBtn.style.display = 'none';
                    showModal('ตอบผิด! กรุณารอ 24 ชั่วโมงเพื่อเล่นอีกครั้ง');
                    // Update countdown every second
                    const countdownInterval = setInterval(function() {
                        diff = lockUntil - Date.now();
                        if (diff <= 0) {
                            clearInterval(countdownInterval);
                            delete userData.missionLockTime;
                            usersData[currentUser] = userData;
                            localStorage.setItem('users', JSON.stringify(usersData));
                            loadQuestion();
                            return;
                        }
                        totalSec = Math.floor(diff / 1000);
                        hours = Math.floor(totalSec / 3600);
                        minutes = Math.floor((totalSec % 3600) / 60);
                        seconds = totalSec % 60;
                        hh = hours.toString().padStart(2, '0');
                        mm = minutes.toString().padStart(2, '0');
                        ss = seconds.toString().padStart(2, '0');
                        if (questionTextEl) {
                            questionTextEl.textContent = 'กรุณารออีก ' + hh + ':' + mm + ':' + ss + ' ก่อนเล่นได้อีกครั้ง';
                        }
                    }, 1000);
                }
            });
        }
    }
});  const path = window.location.pathname.split("/").pop();
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
