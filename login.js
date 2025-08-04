// อ่าน query string เพื่อตรวจสอบว่ามีการ์ดที่ต้องปลดล็อกหรือไม่
const params = new URLSearchParams(window.location.search);
const cardToUnlock = params.get('card');  // เช่น "card5" ถ้ามี ?card=card5
// หากผู้ใช้ล็อกอินอยู่แล้ว ให้ปลดล็อกการ์ด (ถ้ามี query) และไปยังหน้า card.html
const currentUser = localStorage.getItem('currentUser');
if (currentUser) {
  if (cardToUnlock) {
    const cardListKey = currentUser + "_cards";
    const unlockedCards = JSON.parse(localStorage.getItem(cardListKey) || "[]");
    if (!unlockedCards.includes(cardToUnlock)) {
      unlockedCards.push(cardToUnlock);
      localStorage.setItem(cardListKey, JSON.stringify(unlockedCards));
    }
  }
  window.location.href = "card.html";
}

// อ้างอิง element ที่ต้องใช้งาน
const usernameInput = document.getElementById('loginUsername');
const passwordInput = document.getElementById('loginPassword');
const toggleIcon = document.getElementById('toggleLoginPassword');
const loginBtn = document.getElementById('loginBtn');

// อ้างอิงองค์ประกอบของ Modal
const modal = document.getElementById('modal');
const modalMessage = document.getElementById('modalMessage');
const modalOk = document.getElementById('modalOk');

// ฟังก์ชันสลับแสดง/ซ่อนรหัสผ่าน
toggleIcon.addEventListener('click', () => {
  // เช็คประเภทปัจจุบันของช่องรหัสผ่าน
  const currentType = passwordInput.getAttribute('type');
  if (currentType === 'password') {
    // เปลี่ยนเป็นชนิด text เพื่อแสดงรหัส
    passwordInput.setAttribute('type', 'text');
    // เปลี่ยนไอคอนเป็นรูปตาขีดทับ (ซ่อน)
    toggleIcon.classList.remove('fa-eye');
    toggleIcon.classList.add('fa-eye-slash');
  } else {
    // เปลี่ยนกลับเป็นชนิด password เพื่อซ่อนรหัส
    passwordInput.setAttribute('type', 'password');
    // เปลี่ยนไอคอนกลับเป็นรูปตาปกติ
    toggleIcon.classList.remove('fa-eye-slash');
    toggleIcon.classList.add('fa-eye');
  }
});

// ฟังก์ชันเมื่อกดปุ่มเข้าสู่ระบบ
loginBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (username === "" || password === "") {
    // กรณีไม่ได้กรอกชื่อผู้ใช้และรหัสผ่านครบ
    modalMessage.innerText = "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน";
    modal.style.display = "block";
    modalOk.onclick = () => { modal.style.display = "none"; };
    return;
  }

  // ดึงข้อมูลผู้ใช้ทั้งหมดจาก localStorage (หรือ [] ถ้ายังไม่มี)
  const storedUsers = JSON.parse(localStorage.getItem('users') || "[]");

  // ค้นหาผู้ใช้ที่ username/password ตรงกับที่กรอกเข้ามา
  const matchedUser = storedUsers.find(u => u.username === username && u.password === password);

  if (!matchedUser) {
    // ไม่พบบัญชีที่ตรง - แจ้งเตือนล็อกอินไม่สำเร็จ
    modalMessage.innerText = "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
    modal.style.display = "block";
    modalOk.onclick = () => {
      modal.style.display = "none";
    };
  } else {
    // พบข้อมูลผู้ใช้ - ล็อกอินสำเร็จ
    localStorage.setItem('currentUser', username);  // บันทึกชื่อผู้ใช้ที่ล็อกอินปัจจุบัน

    // หากมีการ์ดที่ต้องปลดล็อก ให้บันทึกลงในรายการการ์ดของผู้ใช้
    if (cardToUnlock) {
      const cardListKey = username + "_cards";
      const unlockedCards = JSON.parse(localStorage.getItem(cardListKey) || "[]");
      if (!unlockedCards.includes(cardToUnlock)) {
        unlockedCards.push(cardToUnlock);
        localStorage.setItem(cardListKey, JSON.stringify(unlockedCards));
      }
    }
    // ไปยังหน้า card.html ทันทีหลังล็อกอินสำเร็จ
    window.location.href = "card.html";
  }
});
