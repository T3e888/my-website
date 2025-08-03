// login.js
// ฟังก์ชันสำหรับแสดง modal พร้อมข้อความ และระบุหน้า redirect (ถ้ามี)
let redirectAfterClose = null;
function showModal(message, redirectUrl = null) {
  modalText.innerText = message;
  modal.style.display = "flex";
  redirectAfterClose = redirectUrl;
}

// ฟังก์ชันสำหรับซ่อน modal และดำเนินการ redirect (ถ้าถูกตั้งค่าไว้)
function hideModal() {
  modal.style.display = "none";
  if (redirectAfterClose) {
    window.location.href = redirectAfterClose;
    redirectAfterClose = null;
  }
}

// เลือกองค์ประกอบต่าง ๆ จากหน้า HTML
const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const eyeOpenIcon = document.getElementById("eyeOpen");
const eyeSlashIcon = document.getElementById("eyeSlash");
const modal = document.getElementById("modal");
const modalText = document.getElementById("modalText");
const modalClose = document.getElementById("modalClose");
const modalOk = document.getElementById("modalOk");

// Event: กดไอคอนรูปตา เพื่อแสดง/ซ่อนรหัสผ่าน
togglePassword.addEventListener("click", function () {
  // หากรหัสผ่านถูกซ่อนอยู่ -> แสดงรหัส (type = text) และเปลี่ยนเป็นไอคอนตาขีด
  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    eyeOpenIcon.style.display = "none";
    eyeSlashIcon.style.display = "inline";
  } else {
    // หากรหัสผ่านถูกแสดงอยู่ -> ซ่อนรหัส (type = password) และเปลี่ยนเป็นไอคอนตาปกติ
    passwordInput.type = "password";
    eyeOpenIcon.style.display = "inline";
    eyeSlashIcon.style.display = "none";
  }
});

// Event: กดปุ่มปิด (X) ใน modal
modalClose.onclick = hideModal;
// Event: กดปุ่มตกลงใน modal
modalOk.onclick = hideModal;
// Event: คลิกพื้นที่นอกกรอบ modal เพื่อปิด
modal.addEventListener("click", function (event) {
  if (event.target === modal) {
    hideModal();
  }
});

// Event: เมื่อ submit ฟอร์มล็อกอิน
loginForm.addEventListener("submit", function (event) {
  event.preventDefault();
  const username = usernameInput.value;
  const password = passwordInput.value;
  // ดึงข้อมูลผู้ใช้ทั้งหมดจาก localStorage (ถ้าไม่มีให้ใช้ array ว่าง)
  const users = JSON.parse(localStorage.getItem("users") || "[]");
  // ค้นหาผู้ใช้ที่ username และ password ตรงกัน
  const foundUser = users.find(user => user.username === username && user.password === password);
  if (!foundUser) {
    // หากไม่พบผู้ใช้หรือรหัสผ่านไม่ถูกต้อง -> แสดงข้อผิดพลาด และล้างรหัสผ่านที่กรอก
    showModal("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    passwordInput.value = "";
  } else {
    // ล็อกอินสำเร็จ
    // บันทึกชื่อผู้ใช้ลง currentUser
    localStorage.setItem("currentUser", username);
    // ตรวจสอบ query parameter "card" เพื่อปลดล็อกการ์ด (ถ้ามี)
    const params = new URLSearchParams(window.location.search);
    const cardParam = params.get("card");
    if (cardParam) {
      // ปลดล็อกการ์ดที่ระบุให้กับผู้ใช้นี้
      const cardKey = username + "_cards";
      const userCards = JSON.parse(localStorage.getItem(cardKey) || "[]");
      if (!userCards.includes(cardParam)) {
        userCards.push(cardParam);
        localStorage.setItem(cardKey, JSON.stringify(userCards));
      }
      // แสดงข้อความปลดล็อกการ์ดสำเร็จ และหลังปิด modal ให้ไปหน้า card.html
      showModal("ปลดล็อกการ์ด " + cardParam + " สำเร็จ!", "card.html");
    } else {
      // ล็อกอินสำเร็จแบบปกติ -> ไปหน้า card.html ทันที
      window.location.href = "card.html";
    }
  }
});

// *Login Guard (ตัวอย่าง)* 
// เพิ่มโค้ดนี้ในหน้าที่ต้องการล็อกอินก่อนเข้า (เช่น card.html, scan.html):
// if (!localStorage.getItem("currentUser")) {
//   window.location.href = "login.html";
// }
