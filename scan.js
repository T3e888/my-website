/ --- Auth guard ---
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    const params = new URLSearchParams(location.search);
    const cardParam = params.get('card');
    const keyParam  = params.get('k');
    // Preserve deep link through login (card or k)
    if (cardParam) {
      location.href = `login.html?card=${encodeURIComponent(cardParam)}`;
    } else if (keyParam) {
      location.href = `login.html?k=${encodeURIComponent(keyParam)}`;
    } else {
      location.href = 'login.html';
    }
    return;
  }
  initScanPage(user).catch(console.error);
});

async function initScanPage(user) {
  // ===== Sidebar =====
  const toggleBtn = document.getElementById('menu-toggle');
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('overlay');
  const closeBtn = document.getElementById('close-sidebar');
  const logout   = document.getElementById('logout-link');

  toggleBtn?.addEventListener('click', () => { sidebar.classList.add('open'); overlay.classList.add('active'); });
  function closeSidebar(){ sidebar.classList.remove('open'); overlay.classList.remove('active'); }
  closeBtn?.addEventListener('click', closeSidebar);
  overlay?.addEventListener('click', closeSidebar);
  logout?.addEventListener('click', (e) => { e.preventDefault(); auth.signOut().then(() => location.href='login.html'); });

  // ===== Auto-unlock if ?card=cardX or ?k=key-cardN-XXX is in the URL =====
  const hereParams = new URLSearchParams(location.search);
  const hereCardParam = hereParams.get('card');
  const hereKeyParam  = hereParams.get('k');

  const directCardId =
    (isValidCardId(hereCardParam) ? hereCardParam.toLowerCase() : null) ||
    keyToCardId(hereKeyParam);

  if (directCardId) {
    await saveUnlockedCard(user.uid, directCardId);
    showModal(
      `Unlocked card ${numFromCardId(directCardId)}!<br><img src="assets/cards/${directCardId}.png" style="max-width:220px;border-radius:12px;margin-top:10px">`,
      () => { cleanQueryFromUrl(); location.href = 'card.html'; }
    );
    return;
  } else if (hereCardParam || hereKeyParam) {
    cleanQueryFromUrl();
  }

  // ===== Elements =====
  const uploadPanel = document.getElementById('uploadPanel');
  const cameraPanel = document.getElementById('cameraPanel');
  const cameraLink  = document.getElementById('cameraLink');
  const backToUpload= document.getElementById('backToUpload');
  const video       = document.getElementById('camera');
  const fileInput   = document.getElementById('fileInput');
  const uploadBtn   = document.getElementById('uploadBtn');
  const dropZone    = document.getElementById('dropZone');

  // ===== Upload & drop (works immediately) =====
  uploadBtn?.addEventListener('click', () => fileInput.click());
  fileInput?.addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (f) {
      uploadBtn.textContent = `Choose Image - ${f.name}`;
      await readImageAndDecode(f, async (text) => {
        const card = extractCardId(text);
        if (card) await handleUnlock(user.uid, card);
        else showModal('Invalid QR. Expected one of: ?k=key-cardN-XXX • ?card=cardN • filename like cardN.png');
      });
    }
    e.target.value = '';
  });

  ['dragenter','dragover'].forEach(ev =>
    dropZone?.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.add('dragging'); })
  );
  ['dragleave','drop'].forEach(ev =>
    dropZone?.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.remove('dragging'); })
  );
  dropZone?.addEventListener('drop', async (e) => {
    const f = e.dataTransfer?.files?.[0];
    if (f) {
      uploadBtn.textContent = `Choose Image - ${f.name}`;
      await readImageAndDecode(f, async (text) => {
        const card = extractCardId(text);
        if (card) await handleUnlock(user.uid, card);
        else showModal('Invalid QR. Expected one of: ?k=key-cardN-XXX • ?card=cardN • filename like cardN.png');
      });
    }
  });

  // ===== Camera: start only when user clicks =====
  let stopControls = null; // function to stop any live reader/stream

  cameraLink?.addEventListener('click', async (e) => {
    e.preventDefault();
    uploadPanel.style.display = 'none';
    cameraPanel.classList.add('show');
    stopControls = await startLiveCamera(video, async (raw) => {
      const card = extractCardId(raw);
      if (card) {
        await handleUnlock(user.uid, card);
        if (stopControls) stopControls();
      }
    });
  });

  backToUpload?.addEventListener('click', (e) => {
    e.preventDefault();
    if (stopControls) stopControls();
    cameraPanel.classList.remove('show');
    uploadPanel.style.display = '';
  });

  // ----- helpers -----
  async function handleUnlock(uid, cardId) {
    await saveUnlockedCard(uid, cardId);
    showModal(
      `Unlocked card ${numFromCardId(cardId)}!<br><img src="assets/cards/${cardId}.png" style="max-width:220px;border-radius:12px;margin-top:10px">`,
      () => location.href = 'card.html'
    );
  }
}

// Start camera using BarcodeDetector first, then ZXing video fallback.
// Returns a stop() function.
async function startLiveCamera(videoEl, onResult) {
  // 1) BarcodeDetector
  if ('BarcodeDetector' in window) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      videoEl.srcObject = stream;
      await videoEl.play();
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      let stopped = false;

      const loop = async () => {
        if (stopped) return;
        if (!videoEl.videoWidth) return requestAnimationFrame(loop);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = videoEl.videoWidth;
          canvas.height = videoEl.videoHeight;
          canvas.getContext('2d').drawImage(videoEl, 0, 0);
          const codes = await detector.detect(canvas);
          if (codes && codes.length && codes[0].rawValue) {
            await onResult(codes[0].rawValue);
          }
        } catch {}
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);

      const stop = () => {
        if (stopped) return;
        stopped = true;
        stream.getTracks().forEach(t => t.stop());
        videoEl.srcObject = null;
      };
      return stop;
    } catch (e) {
      console.warn('BarcodeDetector not available:', e);
    }
  }

  // 2) ZXing live fallback
  if (window.ZXingBrowser) {
    try {
      const reader = new ZXingBrowser.BrowserQRCodeReader();
      const controls = await reader.decodeFromVideoDevice(null, videoEl, (result) => {
        if (result && result.text) onResult(result.text);
      });
      return () => { try { controls.stop(); } catch {} videoEl.srcObject = null; };
    } catch (e) {
      console.warn('ZXing video fallback failed:', e);
    }
  }

  showModal('Camera is not available on this device. You can still upload/drag an image to scan.');
  return () => {};
}

// ---------- Parsing helpers ----------
function extractCardId(text) {
  text = (text || '').trim();

  // 1) Already a plain card id?
  if (isValidCardId(text)) return text.toLowerCase();

  // 2) The whole text might already be a key like "key-card10-001"
  const keyDirect = keyToCardId(text);
  if (keyDirect) return keyDirect;

  // 3) Try to parse as URL (full or host-only)
  let u = null;
  try { u = new URL(text); }
  catch {
    if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(text)) { try { u = new URL('https://' + text); } catch {} }
  }
  if (u) {
    // a) new redeem style: ?k=key-cardN-XXX
    const k = u.searchParams.get('k');
    const fromK = keyToCardId(k);
    if (fromK) return fromK;

    // b) old style: ?card=cardN
    const q = u.searchParams.get('card');
    if (isValidCardId(q)) return q.toLowerCase();

    // c) filename fallback: .../cardN.png
    const last = (u.pathname.split('/').pop() || '').toLowerCase();
    const m = last.match(/^card(0?[1-9]|1[0-9]|2[0-5])(?:\.png)?$/);
    if (m) return `card${Number(m[1])}`;
  }

  // 4) Look for “…cardN…” anywhere in raw text
  const m2 = text.toLowerCase().match(/card(0?[1-9]|1[0-9]|2[0-5])\b/);
  if (m2) return `card${Number(m2[1])}`;

  // 5) Look for “…key-cardN-XXX…” anywhere in raw text
  const keyInline = keyToCardId(text);
  if (keyInline) return keyInline;

  return null;
}

// Convert "key-cardN-00X" to "cardN" (N = 1..25)
function keyToCardId(raw){
  if (!raw) return null;
  const s = decodeURIComponent(String(raw)).toLowerCase().trim();
  // Accept: key-card10-001 / keycard10-001 / key-card 10-001 (spaces tolerant)
  const m = s.match(/key-?\s*card\s*(0?[1-9]|1[0-9]|2[0-5])-(?:\d{3})\b/);
  return m ? `card${Number(m[1])}` : null;
}

function isValidCardId(v){ return typeof v==='string' && /^card(0?[1-9]|1[0-9]|2[0-5])$/i.test(v); }
function numFromCardId(id){ return String(Number((id||'').replace(/[^0-9]/g,''))); }

function cleanQueryFromUrl(){
  const url = new URL(location.href);
  url.searchParams.delete('card');
  url.searchParams.delete('k');
  history.replaceState({}, '', url.toString());
}

// ---------- Firestore save ----------
async function saveUnlockedCard(uid, cardId) {
  const docRef = db.collection('users').doc(uid);
  await docRef.set({ cards: firebase.firestore.FieldValue.arrayUnion(cardId) }, { merge: true });
}

// ---------- Image decoding: ZXing first, jsQR fallback ----------
let jsQRLoaded=false;
function loadJsQR(){ return new Promise((res,rej)=>{ if(jsQRLoaded) return res(); const s=document.createElement('script'); s.src='https://unpkg.com/jsqr'; s.onload=()=>{jsQRLoaded=true;res();}; s.onerror=rej; document.body.appendChild(s);}); }
async function readImageAndDecode(file,onDecoded){
  const dataUrl = await new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file); });
  try{
    if(window.ZXingBrowser){
      const img = document.createElement('img'); img.src=dataUrl; await img.decode();
      const reader = new ZXingBrowser.BrowserQRCodeReader();
      const res = await reader.decodeFromImageElement(img);
      if(res && res.text){ onDecoded(res.text); return; }
    }
  }catch{}
  await loadJsQR();
  const img2=new Image();
  img2.onload=()=>{
    const c=document.createElement('canvas'); c.width=img2.width; c.height=img2.height;
    const ctx=c.getContext('2d'); ctx.drawImage(img2,0,0);
    const d=ctx.getImageData(0,0,c.width,c.height);
    const qr=window.jsQR(d.data,d.width,d.height);
    onDecoded(qr?qr.data:'');
  };
  img2.onerror=()=>onDecoded('');
  img2.src=dataUrl;
}

// ---------- Modal ----------
function showModal(msg,cb){
  const modal=document.getElementById('modal');
  modal.innerHTML=`<div class="modal-content">${msg}<br><button class="modal-close">OK</button></div>`;
  modal.classList.add('active');
  modal.querySelector('.modal-close').onclick=()=>{ modal.classList.remove('active'); if(cb) cb(); };
  }
