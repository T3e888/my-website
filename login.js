// --- Show/Hide password ---
const toggleLoginPassword = document.getElementById('toggleLoginPassword');
const loginPasswordInput  = document.getElementById('login-password');
toggleLoginPassword.addEventListener('click', () => {
  const isHidden = loginPasswordInput.type === 'password';
  loginPasswordInput.type = isHidden ? 'text' : 'password';
  toggleLoginPassword.querySelector('i').classList.toggle('fa-eye-slash', isHidden);
  toggleLoginPassword.querySelector('i').classList.toggle('fa-eye', !isHidden);
});

// --- Modal helpers ---
const loginModal    = document.getElementById('loginModal');
const loginModalMsg = document.getElementById('loginModalMsg');
const loginModalBtn = document.getElementById('loginModalBtn');
function showModal(msg, color = '#b21e2c') {
  loginModalMsg.textContent = msg;
  loginModalMsg.style.color = color;
  loginModal.style.display = 'flex';
}
loginModalBtn.addEventListener('click', () => loginModal.style.display = 'none');

// --- Firebase ---
const FAKE_DOMAIN = '@myapp.fake';
const auth = firebase.auth();
const db   = firebase.firestore();

// --- Query params ---
function qp(n){ return new URLSearchParams(location.search).get(n); }
function validCard(v){ return /^card([1-9]|1[0-9]|2[0-5])$/i.test(v || ""); }

const pendingKey  = qp('k');                                   // NEW: key from QR
const pendingCard = validCard(qp('card')) ? qp('card').toLowerCase() : null; // legacy

// --- After sign-in, continue the correct flow ---
auth.onAuthStateChanged(async user => {
  if (!user) return;

  // If we came from a QR (?k=...), bounce back to redeem.html to finish the claim
  if (pendingKey) {
    location.replace(`redeem.html?k=${encodeURIComponent(pendingKey)}`);
    return;
  }

  // Legacy flow: ?card=cardX unlock
  try {
    if (pendingCard) {
      const docRef = db.collection('users').doc(user.uid);
      await docRef.set({
        cards: firebase.firestore.FieldValue.arrayUnion(pendingCard)
      }, { merge: true });
    }
  } catch (_) {
    // ignore errors here; don't block navigation
  }

  location.replace('card.html');
});

// --- Submit login form ---
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
    .then(() => {
      showModal('✅ Login successful!', '#299c34');
      loginModalBtn.onclick = () => {
        // If a key is present, go back to redeem to finish the transaction
        if (pendingKey) {
          location.href = `redeem.html?k=${encodeURIComponent(pendingKey)}`;
        } else {
          location.href = 'card.html';
        }
      };
    })
    .catch(error => showModal('❌ ' + error.message));
});
