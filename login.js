document.getElementById('toggleLoginPassword').onclick = function() {
  const pw = document.getElementById('login-password');
  pw.type = pw.type === "password" ? "text" : "password";
};

const loginForm = document.getElementById('loginForm');
loginForm.addEventListener('submit', function(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  auth.signInWithEmailAndPassword(email, password)
    .then(() => window.location.href = "card.html")
    .catch(err => showModal(err.message));
});

function showModal(msg) {
  document.getElementById('loginModalMsg').innerText = msg;
  document.getElementById('loginModal').style.display = 'flex';
  document.getElementById('loginModalBtn').onclick = () =>
    document.getElementById('loginModal').style.display = 'none';
}
