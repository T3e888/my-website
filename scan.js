// ===== Firebase handles (page already includes firebase compat) =====
/* global firebase, ZXingBrowser */
const auth = firebase.auth();
const db   = firebase.firestore();

/* ---------- small utils ---------- */
const $ = (id) => document.getElementById(id);
function showModal(msg, cb){
  const modal = $("modal");
  modal.innerHTML = `<div class="modal-content">${msg}<br><button class="modal-close">OK</button></div>`;
  modal.classList.add("active");
  modal.querySelector(".modal-close").onclick = () => {
    modal.classList.remove("active");
    cb && cb();
  };
}
function isValidCardId(v){ return typeof v === "string" && /^card(0?[1-9]|1[0-9]|2[0-5])$/i.test(v); }
function numFromCardId(id){ return String(Number((id||"").replace(/[^0-9]/g,""))); }
function cleanCardQueryFromUrl(){
  const url = new URL(location.href);
  url.searchParams.delete("card");
  url.searchParams.delete("k");
  history.replaceState({}, "", url.toString());
}

/* ---------- Firestore save ---------- */
async function saveUnlockedCard(uid, cardId){
  const ref = db.collection("users").doc(uid);
  await ref.set({ cards: firebase.firestore.FieldValue.arrayUnion(cardId) }, { merge: true });
}

/* ---------- PARSING: supports redeem keys ---------- */
/*
  รองรับ:
  - ?k=key-card1-001
  - ?card=card1
  - ชื่อไฟล์ /path/card1.png, card1.jpg
  - ข้อความดิบ "key-card1-001" หรือ "card1"
*/
function mapKeyToCardId(k){
  const s = (k||"").toString().trim().toLowerCase();
  const m = s.match(/^key-?card(\d{1,2})-(\d{3})$/); // key-card10-002
  if (!m) return null;
  const n = Number(m[1]);
  if (n >= 1 && n <= 25) return `card${n}`;
  return null;
}
function extractCardId(text){
  let t = (text||"").trim();
  if (!t) return null;

  // already a card id
  if (isValidCardId(t)) return t.toLowerCase();

  // plain redeem key
  const plainKey = mapKeyToCardId(t);
  if (plainKey) return plainKey;

  // might be a URL
  let u = null;
  try { u = new URL(t); }
  catch {
    if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(t)) {
      try { u = new URL(/^https?:\/\//i.test(t) ? t : "https://"+t); } catch {}
    }
  }

  if (u){
    // 1) redeem key
    const k = u.searchParams.get("k") || u.searchParams.get("key") || u.searchParams.get("code");
    const fromK = mapKeyToCardId(k);
    if (fromK) return fromK;

    // 2) plain ?card=cardX
    const q = u.searchParams.get("card");
    if (isValidCardId(q)) return q.toLowerCase();

    // 3) filename …/cardX.png | .jpg
    const last = (u.pathname.split("/").pop() || "").toLowerCase();
    const mf = last.match(/^(card(0?[1-9]|1[0-9]|2[0-5]))\.(png|jpg|jpeg)$/);
    if (mf) return mf[1];
  }

  // 4) a filename or token inside the text
  const mfile = t.toLowerCase().match(/card(0?[1-9]|1[0-9]|2[0-5])(?:\.(png|jpg|jpeg))?/);
  if (mfile) return `card${Number(mfile[1])}`;

  return null;
}

/* ---------- CAMERA (HD + focus + TRY_HARDER) ---------- */
async function startLiveCamera(videoEl, onResult){
  const constraints = {
    video: {
      facingMode: { ideal: "environment" },
      width:  { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30 },
      advanced: [{ focusMode: "continuous" }]
    }
  };

  // 1) Native BarcodeDetector
  if ("BarcodeDetector" in window){
    try{
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoEl.srcObject = stream;
      await videoEl.play();

      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      let stopped = false, busy = false;

      const loop = async () => {
        if (stopped) return;
        if (!videoEl.videoWidth){ requestAnimationFrame(loop); return; }
        if (busy){ requestAnimationFrame(loop); return; }
        busy = true;
        try{
          const c = document.createElement("canvas");
          c.width  = videoEl.videoWidth;
          c.height = videoEl.videoHeight;
          c.getContext("2d").drawImage(videoEl, 0, 0);
          const codes = await detector.detect(c);
          if (codes && codes.length && codes[0].rawValue){
            await onResult(codes[0].rawValue);
          }
        }catch{}
        busy = false;
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);

      return () => {
        stopped = true;
        try{ stream.getTracks().forEach(t => t.stop()); }catch{}
        videoEl.srcObject = null;
      };
    }catch(e){ console.warn("BarcodeDetector failed:", e); }
  }

  // 2) ZXing video fallback (with TRY_HARDER if available)
  if (window.ZXingBrowser){
    try{
      let reader;
      try{
        const ZX = (window.ZXing || window.ZXingBrowser?.ZXing || {});
        const hints = new Map();
        if (ZX.DecodeHintType && ZX.BarcodeFormat){
          hints.set(ZX.DecodeHintType.TRY_HARDER, true);
          hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [ZX.BarcodeFormat.QR_CODE]);
          reader = new ZXingBrowser.BrowserMultiFormatReader(hints);
        }else{
          reader = new ZXingBrowser.BrowserQRCodeReader();
        }
      }catch{
        reader = new ZXingBrowser.BrowserQRCodeReader();
      }

      const controls = await reader.decodeFromVideoDevice(null, videoEl, (result)=>{
        if (result && result.text) onResult(result.text);
      }, constraints);

      return () => { try{ controls.stop(); }catch{} videoEl.srcObject = null; };
    }catch(e){ console.warn("ZXing video fallback failed:", e); }
  }

  showModal("Camera is not available on this device. You can still upload an image to scan.");
  return () => {};
}

/* ---------- IMAGE decode (multi-pass preprocessing + jsQR) ---------- */
let jsQRLoaded = false;
function loadJsQR(){
  return new Promise((res, rej)=>{
    if (jsQRLoaded) return res();
    const s = document.createElement("script");
    s.src = "https://unpkg.com/jsqr";
    s.onload = ()=>{ jsQRLoaded = true; res(); };
    s.onerror = rej;
    document.body.appendChild(s);
  });
}

async function readImageAndDecode(file, onDecoded){
  const dataUrl = await new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload  = ()=> resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

  const makeCanvas = (img, maxW = 2048) => {
    const scale = Math.min(1, maxW / img.width);
    const c = document.createElement("canvas");
    c.width  = Math.max(1, Math.floor(img.width * scale));
    c.height = Math.max(1, Math.floor(img.height * scale));
    const g = c.getContext("2d", { willReadFrequently: true });
    g.imageSmoothingEnabled = false;
    g.drawImage(img, 0, 0, c.width, c.height);
    return c;
  };
  const toGray = (src) => {
    const c = document.createElement("canvas");
    c.width = src.width; c.height = src.height;
    const g = c.getContext("2d");
    g.drawImage(src, 0, 0);
    const d = g.getImageData(0,0,c.width,c.height);
    const a = d.data;
    for (let i=0;i<a.length;i+=4){
      const y = 0.299*a[i] + 0.587*a[i+1] + 0.114*a[i+2];
      a[i]=a[i+1]=a[i+2]=y;
    }
    g.putImageData(d,0,0);
    return c;
  };
  const contrast = (src, gain=1.3, bias=0) => {
    const c = document.createElement("canvas");
    c.width = src.width; c.height = src.height;
    const g = c.getContext("2d"); g.drawImage(src, 0, 0);
    const d = g.getImageData(0,0,c.width,c.height);
    const a = d.data;
    for (let i=0;i<a.length;i+=4){
      let v = a[i]*gain + bias; v = v<0?0:v>255?255:v;
      a[i]=a[i+1]=a[i+2]=v;
    }
    g.putImageData(d,0,0);
    return c;
  };
  const threshold = (src, th=128, invert=false) => {
    const c = document.createElement("canvas");
    c.width = src.width; c.height = src.height;
    const g = c.getContext("2d"); g.drawImage(src,0,0);
    const d = g.getImageData(0,0,c.width,c.height);
    const a = d.data;
    for (let i=0;i<a.length;i+=4){
      const v = a[i] < th ? 0 : 255;
      const out = invert ? (255 - v) : v;
      a[i]=a[i+1]=a[i+2]=out;
    }
    g.putImageData(d,0,0);
    return c;
  };
  const cropCenterSquare = (src, ratio=0.8) => {
    const size = Math.floor(Math.min(src.width, src.height) * ratio);
    const x = Math.floor((src.width  - size) / 2);
    const y = Math.floor((src.height - size) / 2);
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    c.getContext("2d").drawImage(src, x, y, size, size, 0, 0, size, size);
    return c;
  };
  const rotate = (src, deg=90) => {
    const rad = deg * Math.PI/180;
    const c = document.createElement("canvas");
    c.width = src.height; c.height = src.width;
    const g = c.getContext("2d");
    g.translate(c.width/2, c.height/2);
    g.rotate(rad);
    g.drawImage(src, -src.width/2, -src.height/2);
    return c;
  };

  const img = document.createElement("img");
  await new Promise((resolve) => { img.onload = resolve; img.src = dataUrl; });

  // ZXing จาก element ก่อน (ดีที่สุด)
  try{
    if (window.ZXingBrowser){
      const reader = new ZXingBrowser.BrowserQRCodeReader();
      const res = await reader.decodeFromImageElement(img);
      if (res && res.text){ onDecoded(res.text); return; }
    }
  }catch{}

  await loadJsQR();
  const variants = [];
  const base  = makeCanvas(img, 2048);
  const gray  = toGray(base);
  variants.push(gray);
  variants.push(contrast(gray, 1.6, -20));
  variants.push(threshold(gray, 110, false));
  variants.push(threshold(gray, 140, false));
  variants.push(threshold(gray, 110, true));
  variants.push(cropCenterSquare(gray, 0.9));
  variants.push(cropCenterSquare(contrast(gray, 1.8, -30), 0.85));
  const rot90  = rotate(gray, 90);
  const rot270 = rotate(gray, 270);
  variants.push(rot90, rot270);

  for (const c of variants){
    const ctx = c.getContext("2d");
    const d = ctx.getImageData(0,0,c.width,c.height);
    const q = window.jsQR(d.data, d.width, d.height, { inversionAttempts: "dontInvert" });
    if (q && q.data){ onDecoded(q.data); return; }
    const q2 = window.jsQR(d.data, d.width, d.height, { inversionAttempts: "onlyInvert" });
    if (q2 && q2.data){ onDecoded(q2.data); return; }
  }

  onDecoded("");
}

/* ---------- MAIN PAGE FLOW ---------- */
// Auth guard
auth.onAuthStateChanged(async (user)=>{
  if (!user){
    const p = new URLSearchParams(location.search);
    const cardParam = p.get("card");
    const keyParam  = p.get("k");
    if (cardParam) location.href = `login.html?card=${encodeURIComponent(cardParam)}`;
    else if (keyParam) location.href = `login.html?k=${encodeURIComponent(keyParam)}`;
    else location.href = "login.html";
    return;
  }
  initScanPage(user).catch(console.error);
});

async function initScanPage(user){
  // ===== Sidebar =====
  $("menu-toggle")?.addEventListener("click", ()=>{
    $("sidebar").classList.add("open"); $("overlay").classList.add("active");
  });
  const closeSidebar = ()=>{ $("sidebar").classList.remove("open"); $("overlay").classList.remove("active"); };
  $("close-sidebar")?.addEventListener("click", closeSidebar);
  $("overlay")?.addEventListener("click", closeSidebar);
  $("logout-link")?.addEventListener("click", (e)=>{ e.preventDefault(); auth.signOut().then(()=> location.href="login.html"); });

  // ===== Auto-claim if URL has ?k=… or ?card=… =====
  const here = new URLSearchParams(location.search);
  const fromUrl = extractCardId(here.get("k") || here.get("card") || "");
  if (fromUrl){
    await handleUnlock(user.uid, fromUrl);
    cleanCardQueryFromUrl();
    return;
  }else if (here.get("k") || here.get("card")){
    cleanCardQueryFromUrl();
  }

  // ===== Elements =====
  const uploadPanel = $("uploadPanel");
  const cameraPanel = $("cameraPanel");
  const cameraLink  = $("cameraLink");
  const backToUpload= $("backToUpload");
  const video       = $("camera");
  const fileInput   = $("fileInput");
  const uploadBtn   = $("uploadBtn");
  const dropZone    = $("dropZone");

  // Upload / Drop
  uploadBtn?.addEventListener("click", ()=> fileInput.click());
  fileInput?.addEventListener("change", async (e)=>{
    const f = e.target.files?.[0];
    if (f){
      uploadBtn.textContent = `Choose Image - ${f.name}`;
      await readImageAndDecode(f, async (raw)=>{
        const card = extractCardId(raw);
        if (card) await handleUnlock(user.uid, card);
        else showModal("Invalid QR. Expect a redeem link like “?k=key-cardX-001”, a link with “?card=cardX”, or a filename like “cardX.png”.");
      });
    }
    e.target.value = "";
  });

  ["dragenter","dragover"].forEach(ev =>
    dropZone?.addEventListener(ev, (e)=>{ e.preventDefault(); dropZone.classList.add("dragging"); })
  );
  ["dragleave","drop"].forEach(ev =>
    dropZone?.addEventListener(ev, (e)=>{ e.preventDefault(); dropZone.classList.remove("dragging"); })
  );
  dropZone?.addEventListener("drop", async (e)=>{
    const f = e.dataTransfer?.files?.[0];
    if (f){
      uploadBtn.textContent = `Choose Image - ${f.name}`;
      await readImageAndDecode(f, async (raw)=>{
        const card = extractCardId(raw);
        if (card) await handleUnlock(user.uid, card);
        else showModal("Invalid QR. Expect a redeem link like “?k=key-cardX-001”, a link with “?card=cardX”, or a filename like “cardX.png”.");
      });
    }
  });

  // Camera (on click)
  let stopControls = null;
  cameraLink?.addEventListener("click", async (e)=>{
    e.preventDefault();
    uploadPanel.style.display = "none";
    cameraPanel.classList.add("show");
    stopControls = await startLiveCamera(video, async (raw)=>{
      const card = extractCardId(raw);
      if (card){
        await handleUnlock(user.uid, card);
        stopControls && stopControls();
      }
    });
  });

  backToUpload?.addEventListener("click", (e)=>{
    e.preventDefault();
    stopControls && stopControls();
    cameraPanel.classList.remove("show");
    uploadPanel.style.display = "";
  });

  // helper
  async function handleUnlock(uid, cardId){
    await saveUnlockedCard(uid, cardId);
    const n = numFromCardId(cardId);
    const img = `<img src="assets/cards/${cardId}.png" onerror="this.onerror=null;this.src='assets/cards/${cardId}.jpg';this.alt='${cardId}';">`;
    showModal(`Unlocked card ${n}!<br>${img}`, ()=> location.href = "card.html");
  }
      }
