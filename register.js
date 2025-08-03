// register.js
// ฟังก์ชันสำหรับแสดง modal (ทำงานเหมือนกับในหน้า login)
let redirectAfterClose = null;
function showModal(message, redirectUrl = null) {
  modalText.innerText = message;
  modal.style.display = "flex";
  redirectAfterClose = redirectUrl;
}
function hideModal() {
  modal.style.display = "none";
  if (redirectAfterClose) {
    window.location.href = redirectAfterClose;
    redirectAfterClose = null;
  }
}

// เลือกองค์ประกอบจากหน้า HTML
const registerForm = document.getElementById("registerForm");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const eyeOpenIcon = document.getElementById("eyeOpen");
const eyeSlashIcon = document.getElementById("eyeSlash");
const modal = document.getElementById("modal");
const modalText = document.getElementById("modalText");
const modalClose = document.getElementById("modalClose");
const modalOk = document.getElementById("modalOk");

// Event: คลิกไอคอนรูปตา เพื่อแสดง/ซ่อนรหัสผ่าน
togglePassword.addEventListener("click", function () {
  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    eyeOpenIcon.style.display = "none";
    eyeSlashIcon.style.display = "inline";
  } else {
    passwordInput.type = "password";
    eyeOpenIcon.style.display = "inline";
    eyeSlashIcon.style.display = "none";
  }
});

// Event: ปิด modal เมื่อคลิกปุ่ม X, ปุ่มตกลง, หรือคลิกนอกกรอบ modal
modalClose.onclick = hideModal;
modalOk.onclick = hideModal;
modal.addEventListener("click", function (event) {
  if (event.target === modal) {
    hideModal();
  }
});

// Event: เมื่อ submit ฟอร์มสมัครสมาชิก
registerForm.addEventListener("submit", function (event) {
  event.preventDefault();
  const username = usernameInput.value;
  const password = passwordInput.value;
  // ดึงรายชื่อผู้ใช้ที่มีอยู่จาก localStorage (ถ้ายังไม่มีให้ใช้ array ว่าง)
  const users = JSON.parse(localStorage.getItem("users") || "[]");
  // ตรวจสอบว่าชื่อผู้ใช้ซ้ำหรือไม่
  const existingUser = users.find(user => user.username === username);
  if (existingUser) {
    // หากชื่อผู้ใช้นี้ถูกใช้ไปแล้ว แสดงข้อความเตือน
    showModal("ชื่อผู้ใช้นี้ถูกใช้ไปแล้ว กรุณาเปลี่ยนชื่อใหม่");
  } else {
    // หากไม่ซ้ำ -> สร้างผู้ใช้ใหม่และบันทึกข้อมูล
    const newUser = { username: username, password: password };
    users.push(newUser);
    localStorage.setItem("users", JSON.stringify(users));
    // สร้างรายการการ์ดของผู้ใช้ใหม่เป็น Array ว่าง
    localStorage.setItem(username + "_cards", JSON.stringify([]));
    // แสดงข้อความสมัครสมาชิกสำเร็จ และหลังปิด modal ให้ไปหน้า login
    showModal("สมัครสมาชิกเสร็จสิ้น", "login.html");
  }
});
