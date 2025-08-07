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
const auth = firebase.auth();
const db = firebase.firestore();

// QR card unlock support
function getCardParam() {
  const url = new URL(window.location.href);
  const card = url.searchParams.get("card");
  return /^card([1-9]|1[0-9]|2[0-5])$/.test(card) ? card : null;
}
let pendingCard = getCardParam();

auth.onAuthStateChanged(async user => {
  if (user) {
    // If there's a card param, unlock the card then redirect
    if (pendingCard) {
      const docRef = db.collection('users').doc(user.uid);
      const doc = await docRef.get();
      let cards = (doc.exists && doc.data().cards) ? doc.data().cards : [];
      if (!cards.includes(pendingCard)) {
        cards.push(pendingCard);
        await docRef.update({ cards });
      }
      window.location.href = "card.html";
    } else {
      window.location.href = 'card.html';
    }
  }
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
  auth.signInWithEmailAndPassword(fakeEmail, password)
    .then(async () => {
      // On login, QR card handled by onAuthStateChanged above.
      showModal('✅ Login successful!', '#299c34');
      loginModalBtn.onclick = () => { window.location.href = pendingCard ? window.location.href : "card.html"; };
    })
    .catch(error => {
      showModal('❌ ' + error.message);
    });
});
