// Redirect if already logged in
if (localStorage.getItem('currentUser')) {
  window.location.href = 'card.html';
}

const registerForm = document.getElementById('registerForm');
const registerModal = document.getElementById('registerModal');
const registerModalMsg = document.getElementById('registerModalMsg');
const registerModalBtn = document.getElementById('registerModalBtn');
const toggleRegisterPassword = document.getElementById('toggleRegisterPassword');
const registerPasswordInput = document.getElementById('register-password');

toggleRegisterPassword.addEventListener('click', () => {
  const isHidden = registerPasswordInput.type === 'password';
  registerPasswordInput.type = isHidden ? 'text' : 'password';
  toggleRegisterPassword.querySelector('i').classList.toggle('fa-eye-slash', isHidden);
  toggleRegisterPassword.querySelector('i').classList.toggle('fa-eye', !isHidden);
});

registerModalBtn.addEventListener('click', () => {
  registerModal.style.display = 'none';
});

function showModal(msg, color = '#b21e2c') {
  registerModalMsg.innerHTML = msg;
  registerModalMsg.style.color = color;
  registerModal.style.display = 'flex';
}

registerForm.addEventListener('submit', function(e) {
  e.preventDefault();
  const username = document.getElementById('register-username').value.trim();
  const password = registerPasswordInput.value;

  // Require username and password, min 8 chars
  if (!username || !password || username.length < 8 || password.length < 8) {
    showModal('Please fill in all fields and use at least 8 characters for both username and password.');
    return;
  }

  // Load all users (array) from localStorage
  let users = [];
  try { users = JSON.parse(localStorage.getItem('users') || '[]'); }
  catch { users = []; }

  // Check for duplicate username
  const exists = users.find(u => u.username === username);
  if (exists) {
    showModal('This username is already taken.');
    return;
  }

  // Add user & save updated array
  users.push({ username, password });
  localStorage.setItem('users', JSON.stringify(users));
  localStorage.setItem(`${username}_cards`, JSON.stringify([]));

  showModal('Registration successful!', '#299c34');
  registerModalBtn.onclick = function() {
    window.location.href = 'login.html';
  };
});
