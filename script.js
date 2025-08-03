(() => {
  // Modal utility functions
  const modal = document.getElementById('modal');
  const modalMessage = document.getElementById('modal-message');
  const closeBtn = document.querySelector('.close');
  function showModal(msg) {
    modalMessage.innerHTML = msg;
    modal.style.display = 'block';
  }
  closeBtn.onclick = () => {
    modal.style.display = 'none';
  };
  window.onclick = (event) => {
    if (event.target == modal) {
      modal.style.display = 'none';
    }
  };

  // Load user data from localStorage
  let users = JSON.parse(localStorage.getItem('users') || '{}');

  // Login guard for protected pages
  const page = location.pathname.split('/').pop();
  if (page !== 'login.html' && page !== 'register.html') {
    const loggedInUser = localStorage.getItem('loggedInUser');
    if (!loggedInUser) {
      // Save pending unlock card if present in URL
      const params = new URLSearchParams(location.search);
      if (params.has('unlock')) {
        localStorage.setItem('pendingUnlock', params.get('unlock'));
      }
      location.href = 'login.html';
      return;
    }
  }

  // Login page logic
  if (page === 'login.html') {
    // Show logout success message if returned from logout
    if (localStorage.getItem('loggedOut')) {
      showModal('ออกจากระบบเรียบร้อย');
      localStorage.removeItem('loggedOut');
    }
    document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value;
      const password = document.getElementById('login-password').value;
      if (users[username] && users[username].password === password) {
        // Login successful
        localStorage.setItem('loggedInUser', username);
        location.href = 'card.html';  // proceed to card collection
      } else {
        showModal('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      }
    });
  }

  // Register page logic
  if (page === 'register.html') {
    document.getElementById('registerForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('register-username').value;
      const password = document.getElementById('register-password').value;
      if (users[username]) {
        showModal('ชื่อผู้ใช้นี้ถูกใช้ไปแล้ว กรุณาเปลี่ยนชื่อใหม่');
      } else {
        // Create new user record
        users[username] = {
          password: password,
          cards: Array(25).fill(false),
          missions: { completed: 0, lastDayPlayed: '', missionsToday: 0 }
        };
        localStorage.setItem('users', JSON.stringify(users));
        showModal('สมัครสมาชิกเสร็จสิ้น');
        // Auto-login and redirect to card collection after a short delay
        setTimeout(() => {
          localStorage.setItem('loggedInUser', username);
          location.href = 'card.html';
        }, 2000);
      }
    });
  }

  // Card collection page logic
  if (page === 'card.html') {
    const username = localStorage.getItem('loggedInUser');
    if (username) {
      users = JSON.parse(localStorage.getItem('users') || '{}');
      const userData = users[username];
      // Unlock card if coming from QR link or pending unlock
      let justUnlocked = null;
      if (localStorage.getItem('pendingUnlock')) {
        justUnlocked = localStorage.getItem('pendingUnlock');
        localStorage.removeItem('pendingUnlock');
      }
      const params = new URLSearchParams(location.search);
      if (params.has('unlock')) {
        justUnlocked = params.get('unlock');
      }
      if (justUnlocked) {
        const cardId = parseInt(justUnlocked);
        if (cardId && cardId >= 1 && cardId <= 25) {
          if (!userData.cards[cardId - 1]) {
            userData.cards[cardId - 1] = true;
            users[username] = userData;
            localStorage.setItem('users', JSON.stringify(users));
            showModal('ปลดล็อกการ์ดหมายเลข ' + cardId + ' สำเร็จ!');
          }
        }
      }
      // Display card grid (25 cards)
      const grid = document.getElementById('card-grid');
      grid.innerHTML = '';
      for (let i = 1; i <= 25; i++) {
        const cardSlot = document.createElement('div');
        cardSlot.className = 'card-slot';
        if (userData.cards[i - 1]) {
          // Card unlocked: show image
          const img = document.createElement('img');
          img.src = 'assets/cards/card' + i + '.png';
          img.alt = 'Card ' + i;
          cardSlot.appendChild(img);
        } else {
          // Card locked: keep placeholder
          cardSlot.classList.add('locked');
        }
        grid.appendChild(cardSlot);
      }
    }
  }

  // Scan QR code page logic
  if (page === 'scan.html') {
    const username = localStorage.getItem('loggedInUser');
    if (username) {
      users = JSON.parse(localStorage.getItem('users') || '{}');
      const userData = users[username];
      const fileInput = document.getElementById('qr-input');
      const scanBtn = document.getElementById('scan-btn');
      scanBtn.addEventListener('click', () => {
        fileInput.click();
      });
      fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function () {
          const img = new Image();
          img.onload = function () {
            const canvas = document.getElementById('qr-canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code) {
              const data = code.data;
              const match = data.match(/card(\d+)/i);
              if (match) {
                const cardNum = parseInt(match[1]);
                if (cardNum && cardNum >= 1 && cardNum <= 25) {
                  if (!userData.cards[cardNum - 1]) {
                    userData.cards[cardNum - 1] = true;
                    users[username] = userData;
                    localStorage.setItem('users', JSON.stringify(users));
                    showModal('ปลดล็อกการ์ดหมายเลข ' + cardNum + ' สำเร็จ! <a href="card.html">ดูคอลเลกชัน</a>');
                  } else {
                    showModal('การ์ดนี้ถูกปลดล็อกแล้ว');
                  }
                } else {
                  showModal('QR Code ไม่ถูกต้อง');
                }
              } else {
                showModal('QR Code ไม่ถูกต้อง');
              }
            } else {
              showModal('QR Code ไม่ถูกต้อง');
            }
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    }
  }

  // Mission page logic
  if (page === 'mission.html') {
    const username = localStorage.getItem('loggedInUser');
    if (username) {
      users = JSON.parse(localStorage.getItem('users') || '{}');
      const userData = users[username];
      // Reset daily mission count if it's a new day
      const todayStr = new Date().toISOString().split('T')[0];
      if (userData.missions.lastDayPlayed !== todayStr) {
        userData.missions.lastDayPlayed = todayStr;
        userData.missions.missionsToday = 0;
      }
      // Update mission circles status
      const completed = userData.missions.completed;
      const circles = document.querySelectorAll('.mission-circle');
      circles.forEach(circle => {
        const m = parseInt(circle.dataset.mission);
        circle.classList.remove('completed', 'current', 'locked');
        if (m <= completed) {
          circle.classList.add('completed');
        } else if (m === completed + 1) {
          circle.classList.add('current');
        } else {
          circle.classList.add('locked');
        }
      });
      // Start a mission quiz
      function startMission(missionNumber) {
        // Enforce daily mission limit (max 3 per day)
        if (userData.missions.missionsToday >= 3) {
          showModal('วันนี้ทำมิชชันครบ 3 ด่านแล้ว โปรดลองใหม่พรุ่งนี้');
          return;
        }
        // Only allow starting the next unlocked mission
        if (missionNumber !== userData.missions.completed + 1) {
          return;
        }
        // Prepare question and options (demo content for now)
        const questionEl = document.getElementById('mission-question');
        const optionsEl = document.getElementById('mission-options');
        optionsEl.innerHTML = '';
        let q = '';
        let choices = [];
        let correctIndex = 0;
        if (missionNumber === 1) {
          q = 'ปลาอยู่ในน้ำหรือไม่?';
          choices = ['ใช่', 'ไม่'];
          correctIndex = 0;  // "ใช่" is correct
        } else if (missionNumber === 2) {
          q = 'สัตว์ชนิดใดบินได้?';
          choices = ['นก', 'ช้าง', 'ปลา'];
          correctIndex = 0;  // "นก" is correct
        } else {
          q = '2 + 2 = 4 หรือไม่?';
          choices = ['ใช่', 'ไม่'];
          correctIndex = 0;
        }
        questionEl.textContent = 'ด่าน ' + missionNumber + ': ' + q;
        // Create option buttons
        choices.forEach((choice, index) => {
          const btn = document.createElement('button');
          btn.textContent = choice;
          btn.className = 'option-btn';
          btn.addEventListener('click', () => {
            if (index === correctIndex) {
              // Correct answer: mark mission as completed
              userData.missions.completed = missionNumber;
              userData.missions.missionsToday += 1;
              users[username] = userData;
              localStorage.setItem('users', JSON.stringify(users));
              showModal('ผ่านด่านที่ ' + missionNumber + ' แล้ว!');
              // Update mission circle display
              circles.forEach(c => {
                const m = parseInt(c.dataset.mission);
                c.classList.remove('completed', 'current', 'locked');
                if (m <= userData.missions.completed) {
                  c.classList.add('completed');
                } else if (m === userData.missions.completed + 1) {
                  c.classList.add('current');
                } else {
                  c.classList.add('locked');
                }
              });
              // Hide quiz and return to circle selection
              document.getElementById('mission-quiz').style.display = 'none';
              document.getElementById('missions-container').style.display = 'flex';
            } else {
              // Incorrect answer: prompt to try again
              showModal('คำตอบไม่ถูกต้อง ลองอีกครั้ง');
            }
          });
          optionsEl.appendChild(btn);
        });
        // Show the quiz section
        document.getElementById('missions-container').style.display = 'none';
        document.getElementById('mission-quiz').style.display = 'block';
      }
      // Handle mission circle clicks
      circles.forEach(circle => {
        circle.addEventListener('click', () => {
          const missionNum = parseInt(circle.dataset.mission);
          if (circle.classList.contains('current')) {
            startMission(missionNum);
          } else if (circle.classList.contains('locked')) {
            if (missionNum > userData.missions.completed + 1) {
              showModal('กรุณาทำด่านก่อนหน้าให้เสร็จก่อน');
            }
          }
        });
      });
    }
  }

  // Sidebar toggle and logout (for logged-in pages)
  if (page === 'card.html' || page === 'scan.html' || page === 'mission.html') {
    const menuBtn = document.getElementById('menu-btn');
    const sidebar = document.getElementById('sidebar');
    // Ensure sidebar is hidden initially
    sidebar.style.transform = 'translateX(-100%)';
    menuBtn.addEventListener('click', () => {
      if (sidebar.style.transform === 'translateX(0%)') {
        sidebar.style.transform = 'translateX(-100%)';
      } else {
        sidebar.style.transform = 'translateX(0%)';
      }
    });
    // Close sidebar when any menu link is clicked
    document.querySelectorAll('#sidebar a').forEach(link => {
      link.addEventListener('click', () => {
        sidebar.style.transform = 'translateX(-100%)';
      });
    });
    // Logout action
    document.getElementById('logout').addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('loggedInUser');
      localStorage.setItem('loggedOut', '1');
      location.href = 'login.html';
    });
  }
})();    var userData = JSON.parse(localStorage.getItem('user-' + loggedInUser)) || {};
  }

  // ****** หน้า Login (login.html) ******
  if (document.body.classList.contains('login-page')) {
    // ถ้า login ค้างอยู่แล้ว ให้เข้า card.html ทันที (auto-login)
    if (loggedInUser) {
      window.location.href = 'card.html';
      return;
    }
    // ตรวจสอบค่าสถานะ loggedOut เพื่อแจ้งเตือนออกจากระบบ
    if (localStorage.getItem('loggedOut')) {
      showModal('ออกจากระบบเรียบร้อย');
      localStorage.removeItem('loggedOut');
    }
    // กำหนด event เมื่อส่งฟอร์มล็อกอิน
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', e => {
      e.preventDefault();
      const username = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value;
      if (username === '' || password === '') return;  // ไม่ดำเนินการถ้าข้อมูลไม่ครบ (HTML required ครอบคลุมแล้ว)
      const stored = localStorage.getItem('user-' + username);
      if (stored) {
        const userObj = JSON.parse(stored);
        if (userObj.password === password) {
          // ชื่อผู้ใช้และรหัสผ่านถูกต้อง -> เข้าสู่ระบบ
          localStorage.setItem('loggedInUser', username);
          window.location.href = 'card.html';
        } else {
          // รหัสผ่านไม่ถูกต้อง
          showModal('ชื่อหรือรหัสผ่านไม่ถูกต้อง');
        }
      } else {
        // ไม่พบบัญชีผู้ใช้ชื่อนี้
        showModal('ชื่อหรือรหัสผ่านไม่ถูกต้อง');
      }
    });
  }

  // ****** หน้า Register (register.html) ******
  if (document.body.classList.contains('register-page')) {
    // ถ้าล็อกอินค้างอยู่แล้ว ไม่ควรมา register (redirect ไปหน้าหลัก)
    if (loggedInUser) {
      window.location.href = 'card.html';
      return;
    }
    const registerForm = document.getElementById('registerForm');
    registerForm.addEventListener('submit', e => {
      e.preventDefault();
      const username = document.getElementById('registerUsername').value.trim();
      const password = document.getElementById('registerPassword').value;
      if (username === '' || password === '') return;
      if (localStorage.getItem('user-' + username)) {
        // ชื่อผู้ใช้ซ้ำ แสดงเตือน
        showModal('ชื่อซ้ำ กรุณาเปลี่ยนชื่อใหม่');
      } else {
        // สร้างบัญชีผู้ใช้ใหม่และบันทึกลง localStorage
        const newUser = {
          username: username,
          password: password,
          cards: Array(25).fill(false),    // สถานะการ์ด 25 ใบ (false = ยังไม่ปลดล็อก)
          highestLevel: 0,                // ยังไม่ผ่านด่านใด
          missionsToday: 0,               // จำนวนด่านที่เล่นวันนี้
          lastMissionDate: ''             // วันที่ล่าสุดที่เล่น ('' = ยังไม่เคยเล่น)
        };
        localStorage.setItem('user-' + username, JSON.stringify(newUser));
        localStorage.setItem('loggedInUser', username);
        // สมัครเสร็จ แสดง modal ยืนยัน และ redirect ไป card.html หลังปิด modal
        showModal('สมัครสมาชิกเสร็จสิ้น', 'card.html');
      }
    });
  }

  // ****** หน้า Card Collection (card.html) ******
  if (document.body.classList.contains('card-page')) {
    // QR unlock via URL param: ตรวจสอบว่ามีพารามิเตอร์ ?card=cardX หรือไม่
    const params = new URLSearchParams(window.location.search);
    if (params.has('card')) {
      const code = params.get('card');  // e.g., "card5"
      let cardNum = null;
      if (code && code.startsWith('card')) {
        cardNum = parseInt(code.substring(4));
      }
      if (cardNum && cardNum >= 1 && cardNum <= 25) {
        // หากยังไม่เคยปลดล็อกการ์ดนี้มาก่อน ก็ทำการปลดล็อก
        if (!userData.cards[cardNum - 1]) {
          userData.cards[cardNum - 1] = true;
          localStorage.setItem('user-' + loggedInUser, JSON.stringify(userData));
        }
        showModal('ปลดล็อกการ์ดหมายเลข ' + cardNum + ' แล้ว!');
      } else {
        // กรณีพารามิเตอร์ไม่ถูกต้อง
        showModal('QR Code ไม่ถูกต้อง');
      }
      // ลบ query string ?card=... ออกจาก URL เพื่อป้องกัน modal ซ้ำเมื่อ refresh
      window.history.replaceState({}, '', 'card.html');
    }
    // แสดงการ์ด 25 ใบใน grid: ใช้ข้อมูลจาก userData.cards
    const cardGrid = document.getElementById('card-grid');
    if (cardGrid) {
      cardGrid.innerHTML = '';
      for (let i = 1; i <= 25; i++) {
        const img = document.createElement('img');
        img.alt = 'Card ' + i;
        if (userData.cards && userData.cards[i - 1]) {
          // การ์ดปลดล็อกแล้ว -> แสดงภาพการ์ดจริง
          img.src = 'cards/card' + i + '.png';
          img.className = 'card-img unlocked';
        } else {
          // การ์ดยังล็อก -> แสดงกล่องดำ (placeholder image)
          img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC';
          img.className = 'card-img locked';
        }
        cardGrid.appendChild(img);
      }
    }
  }

  // ****** หน้า Scan QR (scan.html) ******
  if (document.body.classList.contains('scan-page')) {
    // ใช้ไลบรารี Html5QrcodeScanner เพื่อเปิดกล้อง/อ่านไฟล์ QR
    const qrRegion = document.getElementById('qr-reader');
    if (qrRegion) {
      const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 250 });
      // เริ่มการทำงานของ scanner พร้อมกำหนด callback เมื่อสแกนสำเร็จ
      scanner.render((decodedText, decodedResult) => {
        // On successful scan: ตรวจสอบข้อความที่ได้จาก QR
        if (decodedText.includes('card=')) {
          // ถ้าเป็น URL ที่มีพารามิเตอร์ card= (เช่น ".../card.html?card=card5")
          const idx = decodedText.indexOf('card=');
          const code = decodedText.substring(idx + 5);  // เอาค่าส่วนหลัง "card="
          window.location.href = 'card.html?card=' + code;
        } else if (decodedText.toLowerCase().startsWith('card')) {
          // ถ้าเป็นโค้ดรูปแบบ "cardX" ตรง ๆ
          window.location.href = 'card.html?card=' + decodedText;
        } else {
          // ไม่ใช่รูปแบบที่รองรับ -> แจ้งเตือนว่าผิด
          showModal('QR Code ไม่ถูกต้อง');
        }
        // Note: หากสแกนสำเร็จ เรา redirect ทันที จึงไม่ต้อง stop scanner (หน้าใหม่โหลดมาเอง)
      });
    }
  }

  // ****** หน้า Missions (mission.html) ******
  if (document.body.classList.contains('mission-page')) {
    // ก่อนอื่น ตรวจสอบและรีเซ็ตจำนวนด่านรายวันถ้าข้ามวันใหม่
    const todayStr = new Date().toISOString().slice(0, 10);  // "YYYY-MM-DD"
    if (userData.lastMissionDate !== todayStr) {
      userData.missionsToday = 0;
      userData.lastMissionDate = todayStr;
      localStorage.setItem('user-' + loggedInUser, JSON.stringify(userData));
    }
    let highest = userData.highestLevel || 0;         // ด่านสูงสุดที่เคยผ่าน (0 = ยังไม่ผ่านอะไรเลย)
    let missionsToday = userData.missionsToday || 0;  // ด่านที่เล่นผ่านแล้ววันนี้

    // สร้างปุ่มด่าน 1-10 ตามสถานะ (ปลดล็อก/ล็อก/ผ่านแล้ว) และจำกัด 3 ด่านต่อวัน
    const missionsList = document.getElementById('missions-list');
    const quizContainer = document.getElementById('quiz-container');
    const quizQuestion = document.getElementById('quiz-question');
    const quizOptions = document.getElementById('quiz-options');
    const quizSubmit = document.getElementById('quiz-submit');
    const quizFeedback = document.getElementById('quiz-feedback');
    let currentLevel = null;  // ด่านปัจจุบันที่อยู่ในโหมดตอบคำถาม

    // Quiz flow: ฟังก์ชันเริ่มต้นการเล่นด่าน (แสดงแบบทดสอบของด่านนั้น)
    function startLevelQuiz(level) {
      if (!quizContainer) return;
      missionsList.style.display = 'none';    // ซ่อนรายการด่าน
      quizContainer.style.display = 'block';  // แสดงส่วนคำถาม
      currentLevel = level;
      loadQuestion(level);
    }

    // คำถามตัวอย่างสำหรับแต่ละด่าน (เพื่อการทดสอบ สามารถแทนที่ด้วยคำถามจริงได้)
    const questions = {
      1: { q: '2 + 2 = ?', options: ['3', '4'], answer: 1 },
      2: { q: 'เมืองหลวงของประเทศไทยคือเมืองใด?', options: ['กรุงเทพฯ', 'เชียงใหม่'], answer: 0 },
      3: { q: 'What color is the sky?', options: ['Blue', 'Green'], answer: 0 },
      4: { q: '5 x 5 = ?', options: ['25', '30'], answer: 0 },
      5: { q: 'ภาษาอังกฤษ A ถึง Z มีกี่ตัวอักษร?', options: ['24', '26'], answer: 1 },
      6: { q: 'น้ำแข็งมีสถานะอะไร?', options: ['ของแข็ง', 'ของเหลว'], answer: 0 },
      7: { q: 'Which one is a fruit?', options: ['Apple', 'Car'], answer: 0 },
      8: { q: 'ปลา มีขากี่ขา?', options: ['0', '2'], answer: 0 },
      9: { q: 'How many days in a week?', options: ['5', '7'], answer: 1 },
      10:{ q: '1 กิโลกรัม มีกี่กรัม?', options: ['100', '1000'], answer: 1 }
    };

    // โหลดคำถามของด่านที่ระบุ และแสดงตัวเลือก
    function loadQuestion(level) {
      if (!questions[level]) {
        quizQuestion.textContent = 'No question for level ' + level;
        quizOptions.innerHTML = '';
        return;
      }
      const qd = questions[level];
      quizQuestion.textContent = 'ด่าน ' + level + ': ' + qd.q;
      quizOptions.innerHTML = '';
      qd.options.forEach((opt, index) => {
        const lbl = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'quizOption';
        radio.value = index;
        lbl.appendChild(radio);
        lbl.appendChild(document.createTextNode(opt));
        quizOptions.appendChild(lbl);
        quizOptions.appendChild(document.createElement('br'));
      });
      quizFeedback.textContent = '';  // เคลียร์ข้อความ feedback เก่าทิ้ง
    }

    // สร้างปุ่มด่านใน missionsList
    if (missionsList) {
      missionsList.innerHTML = '';
      for (let lv = 1; lv <= 10; lv++) {
        const btn = document.createElement('button');
        btn.textContent = lv;
        btn.className = 'mission-btn';
        if (lv <= highest) {
          // ด่านที่ผ่านแล้ว
          btn.textContent = lv + '✓';
          btn.disabled = true;
          btn.classList.add('completed');
        } else if (lv === highest + 1) {
          // ด่านถัดไปที่ปลดล็อกให้เล่นได้ (ยังไม่เคยเล่น lv นี้)
          if (missionsToday < 3) {
            // ยังไม่ครบโควต้าวันนี้ -> ปุ่มพร้อมเล่น
            btn.disabled = false;
            btn.classList.add('current');
            btn.addEventListener('click', () => startLevelQuiz(lv));
          } else {
            // ครบรอบ 3 ด่านวันนี้แล้ว -> ยังไม่ให้เล่น (ล็อกไว้ถึงวันพรุ่งนี้)
            btn.textContent = lv + '🔒';
            btn.disabled = true;
            btn.classList.add('locked');
          }
        } else {
          // ด่านที่สูงกว่าถัดไป (ยังล็อกอยู่)
          btn.textContent = lv + '🔒';
          btn.disabled = true;
          btn.classList.add('locked');
        }
        missionsList.appendChild(btn);
      }
    }

    // เมื่อผู้ใช้กดปุ่ม Submit ในแบบทดสอบของด่าน
    if (quizSubmit) {
      quizSubmit.addEventListener('click', () => {
        if (currentLevel === null) return;
        // อ่านค่าตัวเลือกที่ผู้ใช้เลือก
        const radios = document.getElementsByName('quizOption');
        let selected = -1;
        for (const r of radios) {
          if (r.checked) {
            selected = parseInt(r.value);
            break;
          }
        }
        if (selected === -1) {
          return;  // ยังไม่ได้เลือกตัวเลือกใด
        }
        if (questions[currentLevel] && selected === questions[currentLevel].answer) {
          // ตอบถูกครบทุกข้อของด่านนี้
          highest = Math.max(highest, currentLevel);
          missionsToday += 1;
          userData.highestLevel = highest;
          userData.missionsToday = missionsToday;
          userData.lastMissionDate = todayStr;
          localStorage.setItem('user-' + loggedInUser, JSON.stringify(userData));
          // ปิด quiz และกลับไปหน้ารายการด่าน
          quizContainer.style.display = 'none';
          missionsList.style.display = 'flex';
          // อัปเดตปุ่มสถานะด่านในรายการ
          const buttons = missionsList.getElementsByTagName('button');
          if (buttons[currentLevel - 1]) {
            buttons[currentLevel - 1].textContent = currentLevel + '✓';
            buttons[currentLevel - 1].disabled = true;
            buttons[currentLevel - 1].classList.add('completed');
          }
          if (currentLevel < 10) {
            if (missionsToday < 3) {
              // ปลดล็อกด่านถัดไป (ถ้ายังไม่ครบ 3 ด่านวันนี้)
              if (buttons[currentLevel]) {
                buttons[currentLevel].textContent = '' + (currentLevel + 1);
                buttons[currentLevel].disabled = false;
                buttons[currentLevel].classList.add('current');
                buttons[currentLevel].addEventListener('click', () => startLevelQuiz(currentLevel + 1));
              }
            } else {
              // ครบด่านสูงสุดของวันนี้ -> ด่านถัดไปยังล็อกไว้ (ใส่กุญแจ)
              if (buttons[currentLevel]) {
                buttons[currentLevel].textContent = (currentLevel + 1) + '🔒';
                buttons[currentLevel].disabled = true;
                buttons[currentLevel].classList.add('locked');
              }
            }
          }
          // แจ้งผ่านด่าน (และสถานะการปลดล็อกด่านถัดไปหรือถึงโควต้า)
          let msg = 'ผ่านด่าน ' + currentLevel + ' เรียบร้อย!';
          if (missionsToday >= 3 && currentLevel < 10) {
            msg += ' คุณเล่นครบ 3 ด่านสำหรับวันนี้แล้ว';
          } else if (currentLevel < 10) {
            msg += ' ด่าน ' + (currentLevel + 1) + ' ถูกปลดล็อกแล้ว';
          }
          showModal(msg);
          currentLevel = null;
        } else {
          // ตอบผิด ให้ลองใหม่ (แสดงข้อความ feedback สีแดง)
          quizFeedback.textContent = 'ผิด! กรุณาลองใหม่';
        }
      });
    }
  }

  // ****** Sidebar และ Logout (สำหรับหน้า card/scan/mission) ******
  const menuBtn = document.getElementById('menuBtn');
  if (menuBtn) {
    const sidebar = document.getElementById('sidebar');
    const closeBtn = document.getElementById('closeSidebar');
    // Toggle sidebar on menu button click
    menuBtn.onclick = () => {
      if (sidebar.classList.contains('show')) {
        sidebar.classList.remove('show');
      } else {
        sidebar.classList.add('show');
      }
    };
    // Close sidebar on close button click (x)
    if (closeBtn) {
      closeBtn.onclick = () => sidebar.classList.remove('show');
    }
    // Logout button action
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.onclick = (e) => {
        e.preventDefault();
        localStorage.removeItem('loggedInUser');
        localStorage.setItem('loggedOut', '1');
        window.location.href = 'login.html';
      };
    }
  }
});

