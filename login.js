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

// Show/hide password
toggleLoginPassword.addEventListener('click', () => {
  const isHidden = loginPasswordInput.type === 'password';
  loginPasswordInput.type = isHidden ? 'text' : 'password';
  toggleLoginPassword.querySelector('i').classList.toggle('fa-eye-slash', isHidden);
  toggleLoginPassword.querySelector('i').classList.toggle('fa-eye', !isHidden);
});

loginModalBtn.addEventListener('click', () => {
  loginModal.style.display = 'none';
});

// Parse card param
function getCardParam() {
  const params = new URLSearchParams(window.location.search);
  const card = params.get('card');
  if (card && /^card\d{1,3}$/.test(card)) return card;
  return null;
}

function showModal(msg, color = '#b21e2c') {
  loginModalMsg.innerHTML = msg;
  loginModalMsg.style.color = color;
  loginModal.style.display = 'flex';
}

loginForm.addEventListener('submit', function(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = loginPasswordInput.value;

  // Username & password must be at least 8 chars
  if (!username || !password || username.length < 8 || password.length < 8) {
    showModal('ใส่ข้อมูลไม่ครบตามกำหนด');
    return;
  }

  let users = [];
  try { users = JSON.parse(localStorage.getItem('users') || '[]'); }
  catch { users = []; }

  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    showModal('❌ Invalid username or password');
    return;
  }

  localStorage.setItem('currentUser', username);

  // Unlock card from QR link
  const unlockCard = getCardParam();
  if (unlockCard) {
    const key = `${username}_cards`;
    let cards = [];
    try { cards = JSON.parse(localStorage.getItem(key) || '[]'); }
    catch { cards = []; }
    if (!cards.includes(unlockCard)) {
      cards.push(unlockCard);
      localStorage.setItem(key, JSON.stringify(cards));
    }
  }
  showModal('✅ Login successful', '#299c34');
  loginModalBtn.onclick = function() {
    window.location.href = 'card.html';
  };
});
