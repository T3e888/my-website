document.getElementById('toggleRegisterPassword').onclick = function() {
  const pw = document.getElementById('register-password');
  pw.type = pw.type === "password" ? "text" : "password";
};

document.getElementById('registerForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  auth.createUserWithEmailAndPassword(email, password)
    .then(cred => {
      // Create starter progress for this user in Firestore!
      return db.collection('users').doc(cred.user.uid).set({
        cards: [],
        mission: Array(10).fill(false),
        quizCount: 0,
        quizDate: ""
      });
    })
    .then(() => {
      showModal("Registration successful!");
      document.getElementById('registerModalBtn').onclick = () =>
        window.location.href = "card.html";
    })
    .catch(err => showModal(err.message));
});

function showModal(msg) {
  document.getElementById('registerModalMsg').innerText = msg;
  document.getElementById('registerModal').style.display = 'flex';
  document.getElementById('registerModalBtn').onclick = () =>
    document.getElementById('registerModal').style.display = 'none';
}
