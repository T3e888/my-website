// login.js
function togglePassword(id) {
  const field = document.getElementById(id);
  field.type = field.type === "password" ? "text" : "password";
}

function showModal(message) {
  document.getElementById('login-modal-message').textContent = message;
  document.getElementById('login-modal').style.display = 'block';
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

function login() {
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;

  const users = JSON.parse(localStorage.getItem("users") || "[]");
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    showModal("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    return;
  }

  localStorage.setItem("currentUser", username);

  // ปลดล็อกการ์ดหากมี query
  const params = new URLSearchParams(window.location.search);
  const cardId = params.get("card");
  if (cardId) {
    const key = `${username}_cards`;
    const unlocked = JSON.parse(localStorage.getItem(key) || "[]");
    if (!unlocked.includes(cardId)) {
      unlocked.push(cardId);
      localStorage.setItem(key, JSON.stringify(unlocked));
      alert(`ปลดล็อกการ์ด ${cardId} สำเร็จ!`);
    }
  }

  window.location.href = "card.html";
}
