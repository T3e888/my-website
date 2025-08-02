// 🔒 ถ้ายังไม่มี token (ยังไม่ล็อกอิน) ให้ redirect ไป login.html
const currentToken = localStorage.getItem('current_token');
if (!currentToken) {
  window.location.href = 'login.html';
}


// Common JavaScript for Stroke Hero Unocker website

// Helper: get stored users array from localStorage
function getUsers() {
    let users = localStorage.getItem('users');
    return users ? JSON.parse(users) : [];
}
// Helper: save users array to localStorage
function saveUsers(users) {
    localStorage.setItem('users', JSON.stringify(users));
}

// Determine current page from URL (filename)
const page = window.location.pathname.split('/').pop();

// 1. Access Control: Redirect to login if not logged in and on a protected page
if (page !== 'login.html' && page !== 'register.html') {
    const loggedIn = localStorage.getItem('loggedIn');
    if (!loggedIn) {
        // Not logged in – save target and redirect to login
        localStorage.setItem('redirectTo', window.location.pathname + window.location.search);
        window.location.href = 'login.html';
    }
} else {
    // If already logged in, redirect away from login/register (optional improvement)
    if (localStorage.getItem('loggedIn')) {
        window.location.href = 'scan.html';
    }
}

// 2. On DOM ready, set up UI event handlers
document.addEventListener('DOMContentLoaded', function() {
    // Sidebar toggle button
    const menuBtn = document.getElementById('menuBtn');
    const sidebar = document.getElementById('sidebar');
    if (menuBtn && sidebar) {
        menuBtn.addEventListener('click', function() {
            sidebar.classList.toggle('open');
        });
    }
    // Display username in sidebar if logged in
    const usernameDisplay = document.getElementById('usernameDisplay');
    if (usernameDisplay) {
        usernameDisplay.textContent = localStorage.getItem('username') || '';
    }
    // Logout button handler
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            localStorage.clear();
            window.location.href = 'login.html';
        });
    }

    // Login form submission handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;
            const users = getUsers();
            const user = users.find(u => u.username === username && u.password === password);
            const errorMsg = document.getElementById('loginError');
            if (user) {
                // Successful login
                localStorage.setItem('loggedIn', 'true');
                localStorage.setItem('username', username);
                // Redirect to target page if any, otherwise to scan.html
                const redirectTo = localStorage.getItem('redirectTo');
                if (redirectTo) {
                    localStorage.removeItem('redirectTo');
                    window.location.href = redirectTo;
                } else {
                    window.location.href = 'scan.html';
                }
            } else {
                if (errorMsg) {
                    errorMsg.textContent = 'Invalid username or password';
                }
            }
        });
    }

    // Register form submission handler
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const username = document.getElementById('registerUsername').value.trim();
            const password = document.getElementById('registerPassword').value;
            const confirm = document.getElementById('registerConfirm').value;
            const errorMsg = document.getElementById('registerError');
            if (password !== confirm) {
                if (errorMsg) {
                    errorMsg.textContent = 'Passwords do not match';
                }
                return;
            }
            let users = getUsers();
            if (users.find(u => u.username === username)) {
                // Username already taken
                if (errorMsg) {
                    errorMsg.textContent = 'Username already exists';
                }
            } else {
                // Save new user and redirect to login
                users.push({username: username, password: password});
                saveUsers(users);
                alert('Registration successful! Please login.');
                window.location.href = 'login.html';
            }
        });
    }

    // Scan page: check if a card unlock code is present in URL
    if (page === 'scan.html') {
        const params = new URLSearchParams(window.location.search);
        const cardParam = params.get('card');
        if (cardParam) {
            // Mark the specified card as unlocked
            localStorage.setItem(cardParam, 'unlocked');
            alert('You have unlocked ' + cardParam + '!');
            // (Remain on scan page; user can navigate to Cards to view)
        }
    }

    // Cards page: replace locked cards with images for unlocked ones
    if (page === 'card.html') {
        document.querySelectorAll('.card-slot').forEach(slot => {
            const cardId = slot.getAttribute('data-card');
            if (localStorage.getItem(cardId) === 'unlocked') {
                // Show the unlocked card image
                slot.innerHTML = '<img src="' + cardId + '.png" alt="' + cardId + '">';
            }
        });
    }
});    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        // บันทึกสถานะล็อกอิน (ในที่นี้ถือว่า success ทันที ไม่ตรวจสอบรหัสเพื่อความง่าย)
        localStorage.setItem('loggedIn', 'true');
        // ดึงพารามิเตอร์ next และ code (ถ้ามี)
        const params = new URLSearchParams(window.location.search);
        const nextParam = params.get('next');
        let redirectUrl = nextParam ? decodeURIComponent(nextParam) : 'index.html';
        // ตรวจสอบ code param ใน next (หรือใน URL ตรงๆ หาก next ไม่มี)
        let code = null;
        if (nextParam) {
          try {
            const targetUrl = new URL(nextParam, window.location.origin);
            code = targetUrl.searchParams.get('code');
          } catch (err) { /* ไม่ต้องทำอะไรหาก next ไม่ใช่ URL ที่เป็น path */ }
        } else {
          code = params.get('code');
        }
        if (code) {
          // ปลดล็อกการ์ดที่ได้จาก code
          let unlocked = JSON.parse(localStorage.getItem('unlockedCards') || '[]');
          if (!unlocked.includes(code)) {
            unlocked.push(code);
            localStorage.setItem('unlockedCards', JSON.stringify(unlocked));
          }
          // ลบพารามิเตอร์ code ออกจาก redirect URL (เพื่อไม่ให้ alert ซ้ำ)
          try {
            const targetUrl = new URL(redirectUrl, window.location.origin);
            targetUrl.searchParams.delete('code');
            redirectUrl = targetUrl.pathname + targetUrl.search;
          } catch (err) { /* กรณี redirectUrl เป็น path ธรรมดา */ }
        }
        // ไปยังหน้าที่ระบุไว้
        window.location.href = redirectUrl;
      });
    }
  }

  // **Card List Page Logic** (index.html): อัปเดตการ์ดล็อก/ปลดล็อก และจัดการ code param
  if (window.location.pathname.endsWith('index.html')) {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      // ปลดล็อกการ์ดตาม code (กรณีผู้ใช้ล็อกอินแล้วมาจากลิงก์ QR)
      let unlocked = JSON.parse(localStorage.getItem('unlockedCards') || '[]');
      if (!unlocked.includes(code)) {
        unlocked.push(code);
        localStorage.setItem('unlockedCards', JSON.stringify(unlocked));
        alert(`ปลดล็อกการ์ด ${code.replace('card', '')} แล้ว!`);
      } else {
        alert("การ์ดนี้ถูกปลดล็อกแล้ว!");
      }
      // ลบ '?code=...' จาก URL เพื่อไม่ให้ปลดล็อกหรือแจ้งเตือนซ้ำเมื่อ refresh
      window.history.replaceState({}, "", window.location.pathname);
    }
    // แสดงผลการ์ดตามสถานะ unlockedCards ใน localStorage
    const unlockedList = JSON.parse(localStorage.getItem('unlockedCards') || '[]');
    document.querySelectorAll('.cards-grid .card').forEach(card => {
      const cardCode = card.dataset.card;
      if (unlockedList.includes(cardCode)) {
        // การ์ดถูกปลดล็อกแล้ว -> แสดงภาพ
        card.classList.remove('locked');
        card.classList.add('unlocked');
        // เพิ่มรูปภาพการ์ด
        const img = document.createElement('img');
        img.src = `images/${cardCode}.png`;
        img.alt = cardCode;
        // ลบเนื้อหาเก่าก่อน (เช่น ไอคอนกุญแจจาก pseudo จะไม่อยู่ใน DOM จริงอยู่แล้ว)
        card.innerHTML = "";
        card.appendChild(img);
      } else {
        // การ์ดยังล็อก -> เป็นกล่องดำ
        card.classList.remove('unlocked');
        card.classList.add('locked');
        card.innerHTML = "";  // เผื่อเคยมีรูปค้าง ก็ลบออก
      }
    });
  }

  // **Missions Page Logic** (mission.html): จัดการระบบภารกิจ 10 ด่านและ countdown 24 ชม.
  if (window.location.pathname.endsWith('mission.html')) {
    const MISSION_COOLDOWN = 24 * 60 * 60 * 1000;  // 24 ชั่วโมง (ms)
    // โหลดข้อมูลภารกิจจาก localStorage หรือสร้างใหม่หากยังไม่มี
    let missionData = JSON.parse(localStorage.getItem('missions') || '[]');
    if (!Array.isArray(missionData)) missionData = [];
    // ให้แน่ใจว่า array มี 10 ช่อง (null หากว่าง)
    for (let j = 0; j < 10; j++) {
      if (typeof missionData[j] === 'undefined') {
        missionData[j] = null;
      }
    }

    let countdownInterval = null;
    function updateMissionUI() {
      // เคลียร์ interval เดิม (ถ้ามี) เพื่อป้องกันซ้อนทับหลายตัว
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
      const now = Date.now();
      // อัปเดตแต่ละภารกิจ (1-10)
      for (let i = 1; i <= 10; i++) {
        const li = document.getElementById('mission' + i);
        const circle = li.querySelector('.circle');
        const prevDoneTime = (i > 1) ? missionData[i - 2] : null;
        const doneTime = missionData[i - 1];
        // เริ่มต้น: ลบคลาสสถานะทั้งหมดก่อน แล้วค่อยเติมตามเงื่อนไข
        li.classList.remove('locked', 'available', 'completed');

        if (i > 1 && prevDoneTime === null) {
          // ยังไม่ได้ทำด่านก่อนหน้า -> ด่านนี้ยังล็อก
          li.classList.add('locked');
          circle.textContent = i;
        } else if (doneTime !== null) {
          // ทำด่านนี้เสร็จแล้ว
          li.classList.add('completed');
          circle.textContent = '✓';
        } else {
          // ยังไม่ทำด่านนี้ (และถ้า i==1 หรือมี prevDoneTime != null)
          if (i === 1 || prevDoneTime !== null) {
            if (i === 1 || now >= prevDoneTime + MISSION_COOLDOWN) {
              // ปลดล็อกให้เล่นได้
              li.classList.add('available');
              circle.textContent = i;
            } else {
              // ล็อกเพราะยังไม่ครบเวลารอ 24 ชม.
              li.classList.add('locked');
              circle.textContent = i;
              // คำนวณเวลาที่เหลือแล้วแสดง countdown
              const unlockTime = prevDoneTime + MISSION_COOLDOWN;
              let remaining = unlockTime - now;
              // สร้างหรือเลือก element แสดงเวลาที่เหลือ
              let countdownElem = li.querySelector('.countdown');
              if (!countdownElem) {
                countdownElem = document.createElement('div');
                countdownElem.className = 'countdown';
                li.insertBefore(countdownElem, li.querySelector('.connector'));
              }
              // ฟังก์ชันช่วยรูปแบบเวลา HH:MM:SS
              function formatTime(ms) {
                const totalSec = Math.floor(ms / 1000);
                const hrs = Math.floor(totalSec / 3600);
                const mins = Math.floor((totalSec % 3600) / 60);
                const secs = totalSec % 60;
                return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
              }
              countdownElem.textContent = 'ปลดล็อกใน ' + formatTime(remaining);
              // อัปเดตตัวเลข countdown ทุกวินาที
              countdownInterval = setInterval(() => {
                const now2 = Date.now();
                const remaining2 = unlockTime - now2;
                if (remaining2 <= 0) {
                  clearInterval(countdownInterval);
                  countdownInterval = null;
                  updateMissionUI();  // อัปเดตสถานะใหม่ (ด่านนี้จะเปลี่ยนเป็น available)
                } else {
                  countdownElem.textContent = 'ปลดล็อกใน ' + formatTime(remaining2);
                }
              }, 1000);
            }
          } else {
            // กรณีไม่ควรเกิด: ถ้า prevDoneTime เป็น null แต่ i > 1 ก็ควรเข้าบล็อกแรกไปแล้ว
            li.classList.add('locked');
            circle.textContent = i;
          }
        }

        // ถ้ามี countdown element อยู่ แต่สถานะปัจจุบันไม่ต้องนับถอยหลังแล้ว ให้ลบทิ้ง
        const existingCountdown = li.querySelector('.countdown');
        if (existingCountdown) {
          // เงื่อนไขที่ไม่ต้องมี countdown: 
          // - ถ้า li ไม่ได้เป็น locked (แปลว่า available หรือ completed แล้ว) 
          // หรือ (ด่านก่อนหน้าไม่มี (i>1 && prevDoneTime === null)) 
          // หรือ (ด่านนี้ทำเสร็จแล้ว) 
          // หรือ (เป็นด่านแรก i===1) 
          // หรือ (มี prevDoneTime และเวลารอครบแล้ว)
          if (!li.classList.contains('locked') ||
              (i > 1 && prevDoneTime === null) ||
              doneTime !== null ||
              i === 1 ||
              (prevDoneTime !== null && now >= prevDoneTime + MISSION_COOLDOWN)) {
            existingCountdown.remove();
          }
        }
      } // end for
    } // end function updateMissionUI

    // เรียกครั้งแรกเมื่อโหลดหน้า
    updateMissionUI();

    // ผูก event ให้ด่านทุกอัน (จะทำงานเมื่อคลิกถ้าด่านนั้น available)
    document.querySelectorAll('.mission-list .mission').forEach(li => {
      li.addEventListener('click', () => {
        if (!li.classList.contains('available')) return;  // กดเฉพาะด่านที่พร้อมเล่น
        const i = parseInt(li.id.replace('mission', ''));
        missionData[i - 1] = Date.now();  // บันทึกเวลาทำภารกิจ (ถือว่าทำเสร็จทันที)
        localStorage.setItem('missions', JSON.stringify(missionData));
        updateMissionUI();
      });
    });
  }
})();        modal.classList.add('hidden');
      }
    });
  }
  function showModal(message) {
    if (modal && modalMsg) {
      modalMsg.textContent = message;
      modal.classList.remove('hidden');
    } else {
      alert(message);
    }
  }

  // Login Form Handler
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      if (!username || !password) {
        showModal('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
        return;
      }
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      const user = users.find(u => u.username === username);
      if (!user || user.password !== password) {
        showModal('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        return;
      }
      // Successful login
      localStorage.setItem('currentUser', user.username);
      location.replace('index.html');
    });
  }

  // Register Form Handler
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('register-username').value.trim();
      const password = document.getElementById('register-password').value;
      const confirmPassword = document.getElementById('register-confirm-password').value;
      if (!username || !password || !confirmPassword) {
        showModal('กรุณากรอกข้อมูลให้ครบ');
        return;
      }
      if (password !== confirmPassword) {
        showModal('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
        return;
      }
      let users = JSON.parse(localStorage.getItem('users') || '[]');
      if (users.find(u => u.username === username)) {
        showModal('ชื่อผู้ใช้นี้ถูกใช้งานแล้ว');
        return;
      }
      // Save new user
      users.push({ username: username, password: password });
      localStorage.setItem('users', JSON.stringify(users));
      // Initialize this user's card collection (25 cards, all locked)
      const initialCards = Array(25).fill(false);
      localStorage.setItem('cards_' + username, JSON.stringify(initialCards));
      // Auto-login after registration
      localStorage.setItem('currentUser', username);
      location.replace('index.html');
    });
  }

  // Card Collection Page (index.html)
  const cardContainer = document.getElementById('card-container');
  if (cardContainer) {
    const user = localStorage.getItem('currentUser');
    if (user) {
      const cardList = JSON.parse(localStorage.getItem('cards_' + user) || '[]');
      // Render 25 cards
      cardContainer.innerHTML = '';
      for (let i = 1; i <= 25; i++) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        if (!cardList[i - 1]) {
          cardDiv.classList.add('locked');
        }
        cardDiv.textContent = i;
        cardContainer.appendChild(cardDiv);
      }
    }
    // Toggle filter to show only unlocked cards
    const filterCheckbox = document.getElementById('filter-unlocked');
    if (filterCheckbox) {
      filterCheckbox.addEventListener('change', () => {
        if (filterCheckbox.checked) {
          cardContainer.classList.add('show-only-unlocked');
        } else {
          cardContainer.classList.remove('show-only-unlocked');
        }
      });
    }
  }

  // Scan Page (scan.html)
  const openCamBtn = document.getElementById('open-camera-btn');
  const fileInput = document.getElementById('file-input');
  const videoEl = document.getElementById('camera-stream');
  let videoStream = null;
  let scanningInterval = null;
  if (openCamBtn) {
    openCamBtn.addEventListener('click', async () => {
      if (!('BarcodeDetector' in window)) {
        showModal('เบราเซอร์นี้ไม่รองรับการสแกนโค้ด');
        return;
      }
      if (videoStream) {
        // If camera is already on, stop it (toggle off)
        openCamBtn.textContent = 'เปิดกล้อง';
        clearInterval(scanningInterval);
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
        if (videoEl) videoEl.style.display = 'none';
      } else {
        // Start camera stream and scanning
        try {
          videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        } catch (err) {
          showModal('ไม่สามารถเข้าถึงกล้องได้');
          return;
        }
        if (videoEl) {
          videoEl.srcObject = videoStream;
          videoEl.style.display = 'block';
          await videoEl.play().catch(e => { /* autoplay might not be allowed without user gesture */ });
        }
        openCamBtn.textContent = 'ปิดกล้อง';
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        scanningInterval = setInterval(async () => {
          try {
            const barcodes = await detector.detect(videoEl);
            if (barcodes.length > 0) {
              // Found a code
              const codeValue = barcodes[0].rawValue;
              handleCodeScanned(codeValue);
            }
          } catch (err) {
            console.error(err);
          }
        }, 1000);
      }
    });
  }
  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      if (!('BarcodeDetector' in window)) {
        showModal('เบราเซอร์นี้ไม่รองรับการสแกนโค้ด');
        return;
      }
      const file = fileInput.files[0];
      if (file) {
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        try {
          const imageBitmap = await createImageBitmap(file);
          const barcodes = await detector.detect(imageBitmap);
          if (barcodes.length === 0) {
            showModal('ไม่พบรหัสใดๆ ในรูปนี้');
          } else {
            const codeValue = barcodes[0].rawValue;
            handleCodeScanned(codeValue);
          }
        } catch (err) {
          console.error(err);
          showModal('ไม่สามารถสแกนรูปนี้ได้');
        }
        // Reset file input to allow re-uploading the same file if needed
        fileInput.value = '';
      }
    });
  }
  // Handle scanned code (from camera or file)
  function handleCodeScanned(code) {
    const user = localStorage.getItem('currentUser');
    if (!user) return;
    let cardList = JSON.parse(localStorage.getItem('cards_' + user) || '[]');
    // Assume the QR code value is a number 1-25 corresponding to a card
    const cardNum = parseInt(code);
    if (!isNaN(cardNum) && cardNum >= 1 && cardNum <= 25) {
      if (cardList[cardNum - 1]) {
        showModal('การ์ดหมายเลข ' + cardNum + ' ถูกปลดล็อกแล้ว');
      } else {
        // Unlock the card
        cardList[cardNum - 1] = true;
        localStorage.setItem('cards_' + user, JSON.stringify(cardList));
        showModal('ปลดล็อกการ์ดหมายเลข ' + cardNum + ' แล้ว!');
        // Update card display if on the collection page
        const cardElements = document.querySelectorAll('.card');
        if (cardElements.length === 25) {
          const cardEl = cardElements[cardNum - 1];
          if (cardEl) {
            cardEl.classList.remove('locked');
          }
        }
      }
    } else {
      showModal('โค้ดที่สแกนไม่ถูกต้อง');
    }
    // Stop camera after scanning one code
    if (videoStream) {
      openCamBtn.textContent = 'เปิดกล้อง';
      videoStream.getTracks().forEach(track => track.stop());
      videoStream = null;
    }
    if (videoEl) videoEl.style.display = 'none';
    if (scanningInterval) clearInterval(scanningInterval);
  }

  // Mission Page (mission.html) - 24h Countdown
  const countdownEl = document.getElementById('countdown');
  if (countdownEl) {
    const user = localStorage.getItem('currentUser');
    const missionKey = 'missionStart_' + user;
    const DAY_MS = 24 * 60 * 60 * 1000;
    let startTime = parseInt(localStorage.getItem(missionKey) || '0');
    if (!startTime || Date.now() - startTime >= DAY_MS) {
      // No mission timer or 24h passed, reset the mission start time to now
      startTime = Date.now();
      localStorage.setItem(missionKey, startTime.toString());
    }
    // Update countdown every second
    function updateCountdown() {
      const now = Date.now();
      let diff = DAY_MS - (now - startTime);
      if (diff < 0) diff = 0;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      // Format HH:MM:SS with leading zeros
      const hh = hours.toString().padStart(2, '0');
      const mm = mins.toString().padStart(2, '0');
      const ss = secs.toString().padStart(2, '0');
      countdownEl.textContent = `${hh}:${mm}:${ss}`;
      if (diff <= 0) {
        clearInterval(timer);
        // Optionally, reset start time for next mission cycle
        localStorage.setItem(missionKey, Date.now().toString());
      }
    }
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
  }

  // Toggle password visibility for all password fields
  document.querySelectorAll('.toggle-password').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const targetId = toggle.getAttribute('data-target');
      const pwdInput = targetId ? document.getElementById(targetId) : null;
      if (pwdInput) {
        if (pwdInput.type === 'password') {
          pwdInput.type = 'text';
          toggle.textContent = 'ซ่อน';
        } else {
          pwdInput.type = 'password';
          toggle.textContent = 'แสดง';
        }
      }
    });
  });

  // Logout functionality
  const logoutLink = document.getElementById('logout-link');
  if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('currentUser');
      // (Keeping users and cards data in localStorage to allow re-login)
      location.href = 'login.html';
    });
  }
});    showModal('กรุณากรอกทั้ง Email และ Password');
  } else if (users[email] && users[email] === pwd) {
    localStorage.setItem('token', email);
    showModal('Login สำเร็จ');
    setTimeout(() => location.href = 'index.html', 800);
  } else {
    showModal('Email หรือ Password ไม่ถูกต้อง');
  }
});

// Register handler
document.getElementById('btnRegister')?.addEventListener('click', () => {
  const email = document.getElementById('regEmail').value.trim();
  const pwd   = document.getElementById('regPassword').value;
  let users    = JSON.parse(localStorage.getItem('users') || '{}');
  if (!email || !pwd) {
    showModal('กรุณากรอกทั้ง Email และ Password');
  } else if (users[email]) {
    showModal('Email นี้ถูกใช้งานแล้ว');
  } else {
    users[email] = pwd;
    localStorage.setItem('users', JSON.stringify(users));
    showModal('Register สำเร็จ');
    setTimeout(() => location.href = 'login.html', 800);
  }
});    const inp = document.getElementById(id);
    inp.type = inp.type === 'password' ? 'text' : 'password';
  };

  // 4. Modal utility
  const modal = document.getElementById('modal');
  const modalMsg = document.getElementById('modalMsg');
  function showModal(msg, time = 1500) {
    if (!modal || !modalMsg) return;
    modalMsg.textContent = msg;
    modal.style.display = 'flex';
    setTimeout(() => modal.style.display = 'none', time);
  }
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) modal.style.display = 'none';
    });
  }

  // 5. Login function
  window.login = () => {
    const email = document.getElementById('loginEmail').value;
    const pwd = document.getElementById('loginPassword').value;
    const users = JSON.parse(localStorage.getItem('users') || '{}');
    if (users[email] === pwd) {
      localStorage.setItem('token', email);
      showModal('เข้าสู่ระบบสำเร็จ!');
      setTimeout(() => {
        const params = new URLSearchParams(window.location.search);
        const redirect = params.get('redirect') || 'index.html';
        const card = params.get('card');
        let dest = redirect;
        if (card) dest += '?card=' + encodeURIComponent(card);
        window.location.href = dest;
      }, 1000);
    } else {
      showModal('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }
  };

  // 6. Register function
  window.register = () => {
    const email = document.getElementById('regEmail').value;
    const pwd = document.getElementById('regPassword').value;
    const users = JSON.parse(localStorage.getItem('users') || '{}');
    if (users[email]) {
      showModal('อีเมลนี้ถูกใช้ไปแล้ว');
    } else {
      users[email] = pwd;
      localStorage.setItem('users', JSON.stringify(users));
      showModal('สมัครสมาชิกสำเร็จ!');
      setTimeout(() => window.location.href = 'login.html', 1000);
    }
  };

  // 7. แสดงชื่อผู้ใช้
  if (token && document.getElementById('usernameDisplay')) {
    document.getElementById('usernameDisplay').textContent = token;
  }

  // 8. Logout
  const logoutLink = document.getElementById('logoutLink');
  if (logoutLink) {
    logoutLink.addEventListener('click', e => {
      e.preventDefault();
      localStorage.removeItem('token');
      showModal('ออกจากระบบแล้ว');
      setTimeout(() => window.location.href = 'login.html', 1000);
    });
  }

  // 9. Render cards (index)
  if (document.getElementById('collection')) {
    const uc = JSON.parse(localStorage.getItem(token + '_cards') || '{}');
    const col = document.getElementById('collection');
    col.innerHTML = '';
    for (let i = 1; i <= 25; i++) {
      const key = 'card' + i;
      const div = document.createElement('div');
      div.className = 'card-slot';
      const img = document.createElement('img');
      img.src = `assets/cards/${key}.png`;
      img.className = 'card-img';
      if (!uc[key]) img.style.filter = 'brightness(0.3) grayscale(100%)';
      div.appendChild(img);
      col.appendChild(div);
    }
  }

  // 10. QR scanner (scan.html)
  if (document.getElementById('cameraBtn')) {
    const video = document.getElementById('video');
    const camBtn = document.getElementById('cameraBtn');
    const stopBtn = document.getElementById('stopBtn');
    const fileI = document.getElementById('fileInput');
    let detector, streamId, scanInt;

    async function handleCode(val) {
      stopCam();
      if (!Array.from({length:25},(_,i)=>`card${i+1}`).includes(val))
        return showModal('QR ไม่ถูกต้อง');
      const um = JSON.parse(localStorage.getItem(token + '_cards') || '{}');
      let msg = 'ปลดล็อก ' + val + ' สำเร็จ!';
      if (um[val]) { um[val]++; msg = 'ได้ซ้ำ ' + val; }
      localStorage.setItem(token + '_cards', JSON.stringify(um));
      document.getElementById('popupTitle').innerText = msg;
      document.getElementById('popupCardImg').src = `assets/cards/${val}.png`;
      document.getElementById('popupCardName').innerText = val;
      document.getElementById('cardPopup').style.display = 'flex';
    }
    function stopCam() {
      clearInterval(scanInt);
      streamId && streamId.getTracks().forEach(t=>t.stop());
      video.style.display = 'none';
      stopBtn.style.display = 'none';
      camBtn.style.display = 'inline-block';
    }
    camBtn.addEventListener('click', async () => {
      if (!('BarcodeDetector' in window)) return showModal('เบราว์เซอร์ไม่รองรับ');
      detector = new BarcodeDetector({formats:['qr_code']});
      try {
        const s = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
        streamId = s;
        video.srcObject = s;
        video.style.display = 'block';
        camBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        scanInt = setInterval(async () => {
          if (video.readyState===video.HAVE_ENOUGH_DATA) {
            const c=document.createElement('canvas');
            c.width=video.videoWidth; c.height=video.videoHeight;
            c.getContext('2d').drawImage(video,0,0);
            const bc=await detector.detect(c);
            if (bc.length) handleCode(bc[0].rawValue);
          }
        },500);
      } catch {
        showModal('ไม่สามารถเข้ากล้องได้');
      }
    });
    stopBtn.addEventListener('click', stopCam);
    fileI.addEventListener('change', e => {
      const f=e.target.files[0];
      if (!f||!('BarcodeDetector'in window)) return;
      detector=new BarcodeDetector({formats:['qr_code']});
      const img=new Image();
      img.onload=async()=>{
        const bc=await detector.detect(img);
        bc.length?handleCode(bc[0].rawValue):showModal('ไม่พบ QR');
      };
      const fr=new FileReader();
      fr.onload=ev=>img.src=ev.target.result;
      fr.readAsDataURL(f);
    });
    document.getElementById('popupClose').onclick = () => {
      document.getElementById('cardPopup').style.display = 'none';
    };
  }

  // 11. Daily mission (mission.html)
  if (document.getElementById('missionBox')) {
    const mb = document.getElementById('missionBox');
    const tm = document.getElementById('timer');
    const key = 'last_mission_' + token;
    const now = Date.now();
    const day = 24*3600*1000;
    const last = +localStorage.getItem(key);
    if (!last || now - last >= day) {
      localStorage.setItem(key, now);
      mb.innerHTML = '<p><strong>ภารกิจ:</strong> ตอบคำถามให้ถูกต้อง!</p>';
    } else {
      const left = day - (now - last);
      const h = Math.floor(left/3600000),
            m = Math.floor((left%3600000)/60000),
            s = Math.floor((left%60000)/1000);
      tm.textContent = `รออีก ${h} ชม. ${m} นาที ${s} วินาที`;
    }
  }
});  const email = document.getElementById('regEmail').value;
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



