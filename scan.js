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

/* ---------- PARSING: now supports redeem keys ---------- */
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
    // try to coerce host-only text into a URL
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

/* ---------- CAMERA (BarcodeDetector -> ZXing video) ---------- */
async function startLiveCamera(videoEl, onResult){
  // Native detector
  if ("BarcodeDetector" in window){
    try{
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      videoEl.srcObject = stream;
      await videoEl.play();
      const detector = new BarcodeDetector({ formats: ["qr_code"] });

      let stopped = false, lock = false;
      const loop = async () => {
        if (stopped) return;
        if (!videoEl.videoWidth){ requestAnimationFrame(loop); return; }
        if (lock){ requestAnimationFrame(loop); return; }
        lock = true;
        try{
          const canvas = document.createElement("canvas");
          canvas.width = videoEl.videoWidth;
          canvas.height = videoEl.videoHeight;
          canvas.getContext("2d").drawImage(videoEl, 0, 0);
          const codes = await detector.detect(canvas);
          if (codes && codes.length && codes[0].rawValue){
            await onResult(codes[0].rawValue);
          }
        }catch{}
        lock = false;
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);

      return () => {
        stopped = true;
        try { stream.getTracks().forEach(t => t.stop()); } catch {}
        videoEl.srcObject = null;
      };
    }catch(e){ console.warn("BarcodeDetector failed:", e); }
  }

  // ZXing video fallback
  if (window.ZXingBrowser){
    try{
      const reader = new ZXingBrowser.BrowserQRCodeReader();
      const controls = await reader.decodeFromVideoDevice(null, videoEl, (result)=>{
        if (result && result.text) onResult(result.text);
      });
      return () => { try{ controls.stop(); }catch{} videoEl.srcObject = null; };
    }catch(e){ console.warn("ZXing video fallback failed:", e); }
  }

  showModal("Camera is not available on this device. You can still upload an image to scan.");
  return () => {};
}

/* ---------- IMAGE decode (ZXing still -> jsQR) ---------- */
let jsQRLoaded = false;
function loadJsQR(){ return new Promise((res, rej)=>{ if(jsQRLoaded){res();return;} const s=document.createElement("script"); s.src="https://unpkg.com/jsqr"; s.onload=()=>{jsQRLoaded=true;res();}; s.onerror=rej; document.body.appendChild(s); }); }
async function readImageAndDecode(file, onDecoded){
  const dataUrl = await new Promise((resolve, reject)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file); });
  try{
    if (window.ZXingBrowser){
      const img = document.createElement("img"); img.src = dataUrl; await img.decode();
      const reader = new ZXingBrowser.BrowserQRCodeReader();
      const res = await reader.decodeFromImageElement(img);
      if (res && res.text){ onDecoded(res.text); return; }
    }
  }catch{}

  await loadJsQR();
  const img2 = new Image();
  img2.onload = () => {
    const c = document.createElement("canvas"); c.width = img2.width; c.height = img2.height;
    const ctx = c.getContext("2d"); ctx.drawImage(img2, 0, 0);
    const d = ctx.getImageData(0,0,c.width,c.height);
    const qr = window.jsQR(d.data, d.width, d.height);
    onDecoded(qr ? qr.data : "");
  };
  img2.onerror = () => onDecoded("");
  img2.src = dataUrl;
}

/* ---------- MAIN PAGE FLOW ---------- */
// Auth guard
auth.onAuthStateChanged(async (user)=>{
  if (!user){
    // keep ?card or ?k if present so we can auto-claim after login
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
        else showModal("Invalid QR. Expect a redeem link like ‘?k=key-cardX-001’, a link with ‘?card=cardX’, or a filename like ‘cardX.png’.");
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
        else showModal("Invalid QR. Expect a redeem link like ‘?k=key-cardX-001’, a link with ‘?card=cardX’, or a filename like ‘cardX.png’.");
      });
    }
  });

  // Camera (on click)
  let stopControls = null;
  $("cameraLink")?.addEventListener("click", async (e)=>{
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

  $("backToUpload")?.addEventListener("click", (e)=>{
    e.preventDefault();
    stopControls && stopControls();
    cameraPanel.classList.remove("show");
    uploadPanel.style.display = "";
  });

  // helper
  async function handleUnlock(uid, cardId){
    await saveUnlockedCard(uid, cardId);

    // show image if exists (.png -> .jpg fallback), else placeholder
    const n = numFromCardId(cardId);
    const img = `<img src="assets/cards/${cardId}.png" onerror="this.onerror=null;this.src='assets/cards/${cardId}.jpg';this.alt='${cardId}';">`;
    showModal(`Unlocked card ${n}!<br>${img}`, ()=> location.href = "card.html");
  }
}
