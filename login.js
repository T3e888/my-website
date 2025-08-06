// Redirect if already logged in
if (localStorage.getItem('currentUser')) {
  window.location.href = 'card.html';
}

const loginForm = document.getElementById('loginForm');
const loginModal = document.getElementById('loginModal');
const loginModalMsg = document.getElementById('loginModalMsg');
const loginModalBtn = document.getElementById('loginModalBtn');
const toggleLoginPassword = document.getElementById('toggleLoginPassword');
const loginPasswordInput = document.getElementById('login-password');

toggleLoginPassword.addEventListener('click', () => {
  const isHidden = loginPasswordInput.type === 'password';
  loginPasswordInput.type = isHidden ? 'text' : 'password';
  toggleLoginPassword.querySelector('i').classList.toggle('fa-eye-slash', isHidden);
  toggleLoginPassword.querySelector('i').classList.toggle('fa-eye', !isHidden);
});

loginModalBtn.addEventListener('click', () => {
  loginModal.style.display = 'none';
});

function showModal(msg, color = '#b21e2c') {
  loginModalMsg.innerHTML = msg;
  loginModalMsg.style.color = color;
  loginModal.style.display = 'flex';
}

loginForm.addEventListener('submit', function(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = loginPasswordInput.value;

  // Require username and password, min 8 chars
  if (!username || !password || username.length < 8 || password.length < 8) {
    showModal('Please fill in all fields and use at least 8 characters for both username and password.');
    return;
  }

  // Load all users (array) from localStorage
  let users = [];
  try { users = JSON.parse(localStorage.getItem('users') || '[]'); }
  catch { users = []; }

  // Find user
  const user = users.find(u => u.username === username);

  if (!user) {
    showModal('This username does not exist in our system. Please check your username or register a new account.');
    return;
  }
  if (user.password !== password) {
    showModal('Incorrect password. Please try again.');
    return;
  }

  localStorage.setItem('currentUser', username);

  showModal('✅ Login successful', '#299c34');
  loginModalBtn.onclick = function() {
    window.location.href = 'card.html';
  };
});
