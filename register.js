// register.js
// register.js
function togglePassword(id) {
  const field = document.getElementById(id);
  field.type = field.type === "password" ? "text" : "password";
}

function showModal(message, callback) {
  document.getElementById('register-modal-message').textContent = message;
  document.getElementById('register-modal').style.display = 'block';

  if (callback) {
    setTimeout(() => {
      document.getElementById('register-modal').style.display = 'none';
      callback();
    }, 1500);
  }
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

function register() {
  const username = document.getElementById("register-username").value;
  const password = document.getElementById("register-password").value;

  const users = JSON.parse(localStorage.getItem("users") || "[]");
  if (users.find(u => u.username === username)) {
    showModal("ชื่อผู้ใช้นี้ถูกใช้ไปแล้ว กรุณาเปลี่ยนชื่อใหม่");
    return;
  }

  users.push({ username, password });
  localStorage.setItem("users", JSON.stringify(users));
  localStorage.setItem("currentUser", username);

  showModal("สมัครสมาชิกเสร็จสิ้น", () => {
    window.location.href = "login.html";
  });
}
