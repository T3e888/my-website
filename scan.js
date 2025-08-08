// --- guard + bootstrap ---
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    // If the page itself has ?card=cardX, send to login with that same param,
    // then login flow can unlock after auth.
    const params = new URLSearchParams(location.search);
    const cardParam = params.get('card');
    if (cardParam) {
      location.href = `login.html?card=${encodeURIComponent(cardParam)}`;
    } else {
      location.href = 'login.html';
    }
    return;
  }

  initScanPage(user).catch(err => console.error(err));
});

async function initScanPage(user) {
  // ====== SIDEBAR (unchanged behavior) ======
  const toggleBtn = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  const closeBtn = document.getElementById('close-sidebar');
  const logout = document.getElementById('logout-link');

  toggleBtn?.addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay.classList.add('active');
  });
  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  }
  closeBtn?.addEventListener('click', closeSidebar);
  overlay?.addEventListener('click', closeSidebar);
  logout?.addEventListener('click', (e) => {
    e.preventDefault();
    auth.signOut().then(() => location.href = 'login.html');
  });
  document.querySelectorAll('#sidebar .menu-item a').forEach(a => {
    if (!a.closest('#logout-link')) a.addEventListener('click', closeSidebar);
  });

  // ====== If this page URL has ?card=cardX, unlock immediately ======
  const hereParams = new URLSearchParams(location.search);
  const hereCard = hereParams.get('card');
  if (isValidCardId(hereCard)) {
    await saveUnlockedCard(user.uid, hereCard);
    showModal(`Unlocked card ${numFromCardId(hereCard)}!<br>
      <img src="assets/cards/${hereCard}.png" style="max-width:220px;border-radius:12px;margin-top:10px">`,
      () => { cleanCardQueryFromUrl(); location.href = 'card.html'; }
    );
    return; // stop camera if any
  } else {
    // Just clean junk/unknown card param from URL
    if (hereCard) cleanCardQueryFromUrl();
  }

  // ====== Live camera scan ======
  const video = document.getElementById('camera');
  const fileInput = document.getElementById('fileInput');
  const uploadBtn = document.getElementById('uploadBtn');
  const dropZone = document.getElementById('dropZone');

  // Start camera with BarcodeDetector if possible
  let stopStream = () => {};
  if ('BarcodeDetector' in window) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = stream;
      await video.play();
      stopStream = () => stream.getTracks().forEach(t => t.stop());

      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      const scanLoop = async () => {
        if (!video.videoWidth) {
          requestAnimationFrame(scanLoop);
          return;
        }
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
          const codes = await detector.detect(canvas);
          if (codes && codes.length) {
            const raw = codes[0].rawValue || '';
            const card = extractCardId(raw);
            if (card) {
              stopStream();
              await handleUnlock(user.uid, card);
              return;
            } else {
              // Not a valid card payload; keep scanning
            }
          }
        } catch (_) {}
        requestAnimationFrame(scanLoop);
      };
      requestAnimationFrame(scanLoop);
    } catch (err) {
      // Camera not allowed; fall back to upload
      console.warn('Camera not available:', err);
    }
  }

  // ====== Upload button ======
  uploadBtn?.addEventListener('click', () => fileInput.click());
  fileInput?.addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (f) await readImageAndDecode(f, async (text) => {
      const card = extractCardId(text);
      if (card) await handleUnlock(user.uid, card);
      else showModal('Invalid QR. Expect a link that has ?card=cardX or a filename like cardX.png');
    });
    e.target.value = '';
  });

  // ====== Drag & drop ======
  ;['dragenter','dragover'].forEach(ev =>
    dropZone?.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.add('dragging'); })
  );
  ;['dragleave','drop'].forEach(ev =>
    dropZone?.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.remove('dragging'); })
  );
  dropZone?.addEventListener('drop', async (e) => {
    const f = e.dataTransfer?.files?.[0];
    if (f) await readImageAndDecode(f, async (text) => {
      const card = extractCardId(text);
      if (card) await handleUnlock(user.uid, card);
      else showModal('Invalid QR. Expect a link that has ?card=cardX or a filename like cardX.png');
    });
  });

  // ====== helpers ======
  async function handleUnlock(uid, cardId) {
    await saveUnlockedCard(uid, cardId);
    showModal(`Unlocked card ${numFromCardId(cardId)}!<br>
      <img src="assets/cards/${cardId}.png" style="max-width:220px;border-radius:12px;margin-top:10px">`,
      () => location.href = 'card.html'
    );
  }
}

// ---------- QR helpers ----------
function extractCardId(text) {
  if (!text) return null;

  // 1) If it's literally "card7" etc.
  if (isValidCardId(text)) return text;

  // 2) If it's a URL, try to read ?card=cardX
  try {
    const u = new URL(text);
    const q = u.searchParams.get('card');
    if (isValidCardId(q)) return q;
    // 3) Or filename includes cardX.png
    const tail = u.pathname.split('/').pop() || '';
    const m = tail.match(/^card([1-9]|1[0-9]|2[0-5])(?:\.png)?$/i);
    if (m) return `card${m[1]}`;
  } catch (_) {
    // Not a URL; keep going
  }

  // 4) Generic regex in the string
  const m2 = text.match(/card([1-9]|1[0-9]|2[0-5])(?!\w)/i);
  if (m2) return `card${m2[1]}`;

  return null;
}

function isValidCardId(v) {
  return typeof v === 'string' && /^card([1-9]|1[0-9]|2[0-5])$/i.test(v);
}
function numFromCardId(cardId) {
  return cardId.replace(/[^0-9]/g, '');
}

function cleanCardQueryFromUrl() {
  const url = new URL(location.href);
  url.searchParams.delete('card');
  history.replaceState({}, '', url.toString());
}

// ---------- Firestore save ----------
async function saveUnlockedCard(uid, cardId) {
  const docRef = db.collection('users').doc(uid);
  await docRef.set(
    { cards: firebase.firestore.FieldValue.arrayUnion(cardId) },
    { merge: true }
  );
}

// ---------- Image decoding (jsQR fallback) ----------
let jsQRLoaded = false;
function loadJsQR() {
  return new Promise((resolve, reject) => {
    if (jsQRLoaded) return resolve();
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/jsqr';
    s.onload = () => { jsQRLoaded = true; resolve(); };
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

async function readImageAndDecode(file, onDecoded) {
  await loadJsQR();
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d').drawImage(img, 0, 0);
    const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const qr = window.jsQR(imageData.data, imageData.width, imageData.height);
    onDecoded(qr ? qr.data : '');
  };
  img.onerror = () => onDecoded('');
  const reader = new FileReader();
  reader.onload = (e) => { img.src = e.target.result; };
  reader.readAsDataURL(file);
}

// ---------- Modal ----------
function showModal(msg, cb) {
  const modal = document.getElementById('modal');
  modal.innerHTML = `<div class="modal-content">${msg}<br>
    <button class="modal-close">OK</button></div>`;
  modal.classList.add('active');
  modal.querySelector('.modal-close').onclick = () => {
    modal.classList.remove('active');
    if (cb) cb();
  };
              }
