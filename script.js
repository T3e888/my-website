// -------------------- User Auth & QR Card Unlock Script ---------------------

// เช็คล็อกอิน (หน้าไหนๆ ก็ใช้)
function checkLoginOrRedirect() {
  if (!localStorage.getItem('currentUser')) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// Register
if (window.location.pathname.endsWith('register.html')) {
  document.getElementById('registerBtn').onclick = function() {
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    if (!email || !password) return alert('กรุณากรอกข้อมูลให้ครบ');
    let users = JSON.parse(localStorage.getItem('users') || '[]');
    if (users.find(u => u.email === email)) return alert('มี email นี้ในระบบแล้ว');
    users.push({ email, password });
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('currentUser', email);
    // รับ param card
    const params = new URLSearchParams(window.location.search);
    const card = params.get('card');
    if (card) unlockCardForUser(email, card, true);
    else window.location.href = 'card.html';
  };
}

// Login
if (window.location.pathname.endsWith('login.html')) {
  document.getElementById('loginBtn').onclick = function() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) return alert('กรุณากรอกข้อมูลให้ครบ');
    let users = JSON.parse(localStorage.getItem('users') || '[]');
    const found = users.find(u => u.email === email && u.password === password);
    if (!found) return alert('email หรือรหัสผ่านไม่ถูกต้อง');
    localStorage.setItem('currentUser', email);
    // รับ param card
    const params = new URLSearchParams(window.location.search);
    const card = params.get('card');
    if (card) unlockCardForUser(email, card, true);
    else window.location.href = 'card.html';
  };
}

// 🔑 ฟังก์ชันปลดล็อกการ์ดให้ผู้ใช้ (เรียกใช้จาก scan.html, login.html, register.html)
function unlockCardForUser(email, card, redirectAfter) {
  if (!email || !card) return;
  const key = `unlocked_${email}`;
  let unlocked = JSON.parse(localStorage.getItem(key) || '[]');
  if (!unlocked.includes(card)) unlocked.push(card);
  localStorage.setItem(key, JSON.stringify(unlocked));
  if (redirectAfter) window.location.href = `card.html?card=${card}`;
}
