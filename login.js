const toggleLoginPassword = document.getElementById('toggleLoginPassword');
const loginPasswordInput = document.getElementById('login-password');
toggleLoginPassword.addEventListener('click', () => {
  const isHidden = loginPasswordInput.type === 'password';
  loginPasswordInput.type = isHidden ? 'text' : 'password';
  toggleLoginPassword.querySelector('i').classList.toggle('fa-eye-slash', isHidden);
  toggleLoginPassword.querySelector('i').classList.toggle('fa-eye', !isHidden);
});

// Modal helpers
const loginModal     = document.getElementById('loginModal');
const loginModalMsg  = document.getElementById('loginModalMsg');
const loginModalBtn  = document.getElementById('loginModalBtn');
function showModal(msg, color='#b21e2c') {
  loginModalMsg.textContent = msg;
  loginModalMsg.style.color = color;
  loginModal.style.display = 'flex';
}
loginModalBtn.addEventListener('click', () => loginModal.style.display = 'none');

const FAKE_DOMAIN = '@myapp.fake';

firebase.auth().onAuthStateChanged(user => {
  if (user) window.location.href = 'card.html';
});

document.getElementById('loginForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = loginPasswordInput.value;
  if (!username || !password) {
    showModal('Please enter both username and password.');
    return;
  }
  const fakeEmail = username + FAKE_DOMAIN;
  firebase.auth().signInWithEmailAndPassword(fakeEmail, password)
    .then(() => {
      showModal('✅ Login successful!', '#299c34');
      loginModalBtn.onclick = () => { window.location.href = 'card.html'; };
    })
    .catch(error => {
      showModal('❌ ' + error.message);
    });
});
