// อ้างอิง element ของหน้าสมัครสมาชิก
const usernameInput = document.getElementById('regUsername');
const passwordInput = document.getElementById('regPassword');
const toggleIcon = document.getElementById('toggleRegPassword');
const registerBtn = document.getElementById('registerBtn');

// Modal elements
const modal = document.getElementById('modal');
const modalMessage = document.getElementById('modalMessage');
const modalOk = document.getElementById('modalOk');

// ฟังก์ชันสลับแสดง/ซ่อนรหัสผ่าน (เหมือนกับ login.js)
toggleIcon.addEventListener('click', () => {
  const currentType = passwordInput.getAttribute('type');
  if (currentType === 'password') {
    passwordInput.setAttribute('type', 'text');
    toggleIcon.classList.remove('fa-eye');
    toggleIcon.classList.add('fa-eye-slash');
  } else {
    passwordInput.setAttribute('type', 'password');
    toggleIcon.classList.remove('fa-eye-slash');
    toggleIcon.classList.add('fa-eye');
  }
});

// ฟังก์ชันเมื่อคลิกปุ่มสมัครสมาชิก
registerBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (username === "" || password === "") {
    // กรณีกรอกไม่ครบ
    modalMessage.innerText = "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน";
    modal.style.display = "block";
    modalOk.onclick = () => { modal.style.display = "none"; };
    return;
  }

  // ดึงข้อมูลผู้ใช้เดิมทั้งหมด
  const storedUsers = JSON.parse(localStorage.getItem('users') || "[]");

  // ตรวจสอบชื่อผู้ใช้ซ้ำ
  const existingUser = storedUsers.find(u => u.username === username);
  if (existingUser) {
    // พบว่าชื่อผู้ใช้นี้ถูกใช้ไปแล้ว
    modalMessage.innerText = "ชื่อผู้ใช้นี้ถูกใช้ไปแล้ว กรุณาเปลี่ยนชื่อใหม่";
    modal.style.display = "block";
    modalOk.onclick = () => {
      modal.style.display = "none";
    };
  } else {
    // สามารถใช้ชื่อผู้ใช้นี้ได้ - ทำการสมัคร
    const newUser = { username: username, password: password };
    storedUsers.push(newUser);
    localStorage.setItem('users', JSON.stringify(storedUsers));
    // สร้างรายการการ์ดว่างสำหรับผู้ใช้ใหม่
    localStorage.setItem(username + "_cards", JSON.stringify([]));

    // แจ้งสมัครสำเร็จ
    modalMessage.innerText = "สมัครสมาชิกเสร็จสิ้น";
    modal.style.display = "block";
    modalOk.onclick = () => {
      modal.style.display = "none";
      // ย้อนกลับไปหน้าเข้าสู่ระบบให้ผู้ใช้ล็อกอิน
      window.location.href = "login.html";
    };
  }
});
