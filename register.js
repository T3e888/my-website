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

document.getElementById('registerForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const username = document.getElementById('register-username').value.trim();
  const password = registerPasswordInput.value;

  if (!username || !password) {
    showModal('Please enter both username and password.');
    return;
  }
  if (username.length < 3) {
    showModal('Username must be at least 3 characters.');
    return;
  }
  if (password.length < 6) {
    showModal('Password must be at least 6 characters.');
    return;
  }

  const fakeEmail = username + FAKE_DOMAIN;

  // Check for existing username
  db.collection('users').where('username', '==', username).get().then(snapshot => {
    if (!snapshot.empty) {
      showModal('This username is already taken. Please use another.');
      return;
    }
    // Create the Firebase Auth user
    auth.createUserWithEmailAndPassword(fakeEmail, password)
      .then(cred => {
        // Create user doc in Firestore
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
      .catch(err => {
        let msg = err.message;
        if (msg.includes("already in use")) msg = "Username already exists.";
        showModal('❌ ' + msg);
      });
  }).catch(error => showModal('❌ ' + error.message));
});
