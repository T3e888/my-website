<!-- app.js -->
<script>
/* ==== Firebase (compat) – shared init + helpers ==== */
(() => {
  const firebaseConfig = {
    apiKey:"AIzaSyAY684l419wAeZwfMLS5dJVfZaNuW3drTY",
    authDomain:"login-ba993.firebaseapp.com",
    projectId:"login-ba993",
    storageBucket:"login-ba993.appspot.com",
    messagingSenderId:"86689747767",
    appId:"1:86689747767:web:0bd80f58f6516d4c73c0b2",
    measurementId:"G-33LJCV1MD8"
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const auth = firebase.auth();
  const db   = firebase.firestore();

  // ---------- UI helpers ----------
  function qs(sel){ return document.querySelector(sel); }
  function qa(sel){ return Array.from(document.querySelectorAll(sel)); }

  function toggleSidebar(show) {
    const sb = qs('.sidebar');
    const bd = qs('.backdrop');
    const open = (show===true) ? true : (show===false) ? false : !sb.classList.contains('open');
    sb.classList.toggle('open', open);
    bd.classList.toggle('show', open);
  }

  function setActive(id) {
    qa('.menu a').forEach(a => a.classList.toggle('active', a.id === id));
  }

  // Require a signed-in user; otherwise send to login
  function requireAuth() {
    return new Promise(resolve => {
      const u = auth.currentUser;
      if (u) return resolve(u);
      const unsub = auth.onAuthStateChanged(user => {
        unsub();
        if (user) resolve(user);
        else location.href = 'login.html';
      });
    });
  }

  function doLogout() {
    auth.signOut().finally(() => location.href = 'login.html');
  }

  // Wire menu/backdrop clicks if present
  window.addEventListener('DOMContentLoaded', () => {
    const btn = qs('#menu-btn');
    const bd  = qs('.backdrop');
    if (btn) btn.addEventListener('click', () => toggleSidebar());
    if (bd)  bd.addEventListener('click', () => toggleSidebar(false));
  });

  // Expose minimal API
  window.app = { auth, db, toggleSidebar, setActive, requireAuth, doLogout };
})();
</script>
