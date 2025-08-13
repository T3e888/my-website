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
const db   = firebase.firestore();
const fn   = firebase.functions();

// --- query params ---
function qp(n){ return new URLSearchParams(location.search).get(n); }
function validCard(v){ return /^card([1-9]|1[0-9]|2[0-5])$/.test(v || ""); }
const pendingCard = validCard(qp('card')) ? qp('card') : null; // legacy card unlock
const pendingKey  = qp('k');                                   // NEW secure key
const sig         = qp('s') || "";                             // optional signature
const ts          = qp('t') || "";                             // optional timestamp

auth.onAuthStateChanged(async user => {
  if (!user) return;

  try {
    // NEW: redeem key if present
    if (pendingKey) {
      const redeem = fn.httpsCallable('redeemKey');
      await redeem({ k: pendingKey, s: sig, t: ts });
      window.location.replace('card.html');
      return;
    }
    // legacy ?card= flow (keep)
    if (pendingCard) {
      const docRef = db.collection('users').doc(user.uid);
      const doc = await docRef.get();
      let cards = (doc.exists && doc.data().cards) ? doc.data().cards : [];
      if (!cards.includes(pendingCard)) {
        cards.push(pendingCard);
        await docRef.update({ cards });
      }
    }
  } catch(e) {
    // don't block login if redeem fails
  }
  window.location.replace('card.html');
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
    .then(() => {
      showModal('✅ Login successful!', '#299c34');
      loginModalBtn.onclick = () => {
        if (pendingKey) location.href = `redeem.html?k=${encodeURIComponent(pendingKey)}${sig?`&s=${encodeURIComponent(sig)}`:""}${ts?`&t=${encodeURIComponent(ts)}`:""}`;
        else location.href = pendingCard ? location.href : "card.html";
      };
    })
    .catch(error => showModal('❌ ' + error.message));
});
