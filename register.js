const toggleRegisterPassword = document.getElementById('toggleRegisterPassword');
const registerPasswordInput = document.getElementById('register-password');
toggleRegisterPassword.addEventListener('click', () => {
  const isHidden = registerPasswordInput.type === 'password';
  registerPasswordInput.type = isHidden ? 'text' : 'password';
  toggleRegisterPassword.querySelector('i').classList.toggle('fa-eye-slash', isHidden);
  toggleRegisterPassword.querySelector('i').classList.toggle('fa-eye', !isHidden);
});

const registerModal = document.getElementById('registerModal');
const registerModalMsg = document.getElementById('registerModalMsg');
const registerModalBtn = document.getElementById('registerModalBtn');
function showModal(msg, color='#b21e2c') {
  registerModalMsg.textContent = msg;
  registerModalMsg.style.color = color;
  registerModal.style.display = 'flex';
}
registerModalBtn.addEventListener('click', () => registerModal.style.display = 'none');

const FAKE_DOMAIN = '@myapp.fake';

document.getElementById('registerForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const username = document.getElementById('register-username').value.trim();
  const password = registerPasswordInput.value;
  if (!username || !password) {
    showModal('Please enter both username and password.');
    return;
  }
  const fakeEmail = username + FAKE_DOMAIN;

  // Check username uniqueness in Firestore
  const snapshot = await db.collection('users').where('username', '==', username).get();
  if (!snapshot.empty) {
    showModal('This username is already taken. Please use another.');
    return;
  }

  auth.createUserWithEmailAndPassword(fakeEmail, password)
    .then(cred => {
      // Save user data in Firestore
      return db.collection('users').doc(cred.user.uid).set({
        username: username,
        cards: [],
        mission: Array(10).fill(false),
        quizCount: 0,
        quizDate: ""
      });
    })
    .then(() => {
      showModal("Registration successful!", "#299c34");
      registerModalBtn.onclick = () =>
        window.location.href = "card.html";
    })
    .catch(err => showModal('❌ ' + err.message));
});
