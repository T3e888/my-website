const auth = firebase.auth();
const db = firebase.firestore();
const FAKE_DOMAIN = '@myapp.fake';

// QR card unlock support
function getCardParam() {
  const url = new URL(window.location.href);
  const card = url.searchParams.get("card");
  return /^card([1-9]|1[0-9]|2[0-5])$/.test(card) ? card : null;
}
let pendingCard = getCardParam();

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
    .then(async cred => {
      // Create starter doc
      let cardArr = [];
      if (pendingCard) cardArr = [pendingCard];
      await db.collection('users').doc(cred.user.uid).set({
        username: username,
        cards: cardArr,
        mission: Array(15).fill(false),
        quizCount: 0,
        quizDate: ""
      });
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
