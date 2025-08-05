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

function getCardParam() {
  const params = new URLSearchParams(window.location.search);
  const card = params.get('card');
  if (card && /^card\d{1,3}$/.test(card)) return card;
  return null;
}

function showModal(msg, color = '#b21e2c') {
  registerModalMsg.innerHTML = msg;
  registerModalMsg.style.color = color;
  registerModal.style.display = 'flex';
}

// THE CRUCIAL PART!
registerForm.addEventListener('submit', function(e) {
  e.preventDefault();
  const username = document.getElementById('register-username').value.trim();
  const password = registerPasswordInput.value;

  // --- ENGLISH VALIDATION ---
  if (!username || !password || username.length < 8 || password.length < 8) {
    showModal('Please fill in all fields and use at least 8 characters.');
    return;
  }

  let users = [];
  try { users = JSON.parse(localStorage.getItem('users') || '[]'); }
  catch { users = []; }

  const exists = users.find(u => u.username === username);
  if (exists) {
    showModal('This username is already taken');
    return;
  }

  users.push({ username, password });
  localStorage.setItem('users', JSON.stringify(users));
  localStorage.setItem(`${username}_cards`, JSON.stringify([]));

  const unlockCard = getCardParam();
  if (unlockCard) {
    localStorage.setItem(`${username}_cards`, JSON.stringify([unlockCard]));
  }

  showModal('Registration successful', '#299c34');
  registerModalBtn.onclick = function() {
    window.location.href = 'login.html';
  };
});
