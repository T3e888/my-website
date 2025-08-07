const auth = firebase.auth();
const db = firebase.firestore();
const FAKE_DOMAIN = '@myapp.fake';

document.getElementById('toggleRegisterPassword').onclick = function() {
  const pw = document.getElementById('register-password');
  pw.type = pw.type === "password" ? "text" : "password";
};

document.getElementById('registerForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value;
  if (!username || !password) {
    showModal('Please enter both username and password.');
    return;
  }
  const fakeEmail = username + FAKE_DOMAIN;
  auth.createUserWithEmailAndPassword(fakeEmail, password)
    .then(cred => {
      // Save starter data to their user doc
      return db.collection('users').doc(cred.user.uid).set({
        username: username,
        cards: [],
        mission: Array(10).fill(false),
        quizCount: 0,
        quizDate: ""
      });
    })
    .then(() => {
      showModal("Registration successful!", "#2e7d32");
      document.getElementById('registerModalBtn').onclick = () =>
        window.location.href = "card.html";
    })
    .catch(error => {
      if (error.code === 'auth/email-already-in-use') {
        showModal("This username is already taken.");
      } else {
        showModal(error.message);
      }
    });
});

function showModal(msg, color='#b21e2c') {
  const modal = document.getElementById('registerModal');
  document.getElementById('registerModalMsg').innerText = msg;
  document.getElementById('registerModalMsg').style.color = color;
  modal.style.display = 'flex';
  document.getElementById('registerModalBtn').onclick = () =>
    modal.style.display = 'none';
    }
