// ===== Firebase handles (page includes compat SDK already) =====
/* global firebase, ZXingBrowser */
const auth = firebase.auth();
const db   = firebase.firestore();

/* ---------- DOM helpers & modal ---------- */
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

/* ---------- tiny utils ---------- */
function isValidCardId(v){ return typeof v === "string" && /^card(0?[1-9]|1[0-9]|2[0-5])$/i.test(v); }
function numFromCardId(id){ return String(Number((id||"").replace(/[^0-9]/g,""))); }
function cleanCardQueryFromUrl(){
  const url = new URL(location.href);
  url.searchParams.delete("card");
  url.searchParams.delete("k");
  url.searchParams.delete("key");
  url.searchParams.delete("code");
  history.replaceState({}, "", url.toString());
}

/* ---------- Firestore save ---------- */
async function saveUnlockedCard(uid, cardId){
  const ref = db.collection("users").doc(uid);
  await ref.set({ cards: firebase.firestore.FieldValue.arrayUnion(cardId) }, { merge: true });
}

/* ---------- Mapping redeem keys -> card ids ---------- */
/*
  Accept:
  - ?k=key-card1-001 (also ?key= or ?code=)
  - ?card=card1
  - filename like /path/card1.png or card1.jpg
  - raw "key-card1-001" or "card1"
  - raw query string like "k=key-card1-001"
*/
function mapKeyToCardId(k){
  const s = (k||"").toString().trim().toLowerCase();
  const m = s.match(/^key-?card(\d{1,2})-(\d{3})$/);   // e.g. key-card10-002
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

  // raw query-style string: k=key-cardX-YYY
  const rawParam = t.match(/[?&#]?(?:k|key|code)=([^&#\s]+)/i);
  if (rawParam){
    const viaParam = mapKeyToCardId(rawParam[1]);
    if (viaParam) return viaParam;
  }

  // plain redeem key
  const plainKey = mapKeyToCardId(t);
  if (plainKey) return plainKey;

  // try as URL (full or host-only)
  let u = null;
  try { u = new URL(t); }
  catch {
    if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(t)) {
      try { u = new URL(/^https?:\/\//i.test(t) ? t : "https://" + t); } catch {}
    }
  }

  if (u){
    // 1) ?k / ?key / ?code
    const k = u.searchParams.get("k") || u.searchParams.get("key") || u.searchParams.get("code");
    const fromK = mapKeyToCardId(k);
    if (fromK) return fromK;

    // 2) ?card=cardX
    const q = u.searchParams.get("card");
    if (isValidCardId(q)) return q.toLowerCase();

    // 3) filename …/cardX.png | .jpg
    const last = (u.pathname.split("/").pop() || "").toLowerCase();
    const mf = last.match(/^(card(0?[1-9]|1[0-9]|2[0-5]))\.(png|jpg|jpeg)$/);
    if (mf) return mf[1];
  }

  // 4) token inside the text
  const mfile = t.toLowerCase().match(/card(0?[1-9]|1[0-9]|2[0-5])(?:\.(png|jpg|jpeg))?/);
  if (mfile) return `card${Number(mfile[1])}`;

  return null;
}

/* ---------- CAMERA (BarcodeDetector -> ZXing video) ---------- */
async function startLiveCamera(videoEl, onResult){
  // Native detector first
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

  // ZXing live fallback
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
    // keep params so we can auto-claim after login
    const p = new URLSearchParams(location.search);
    const cardParam = p.get("card");
    const keyParam  = p.get("k") || p.get("key") || p.get("code");
    if (cardParam) location.href = `login.html?card=${encodeURIComponent(cardParam)}`;
    else if (keyParam) location.href = `login.html?k=${encodeURIComponent(keyParam)}`;
    else location.href = "login.html";
    return;
  }
  initScanPage(user).catch(console.error);
});

async function initScanPage(user){
  // If an overlay is somehow left on from another page, clear it.
  $("overlay")?.classList.remove("active");
  $("sidebar")?.classList.remove("open");

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
  const fromUrl = extractCardId(here.get("k") || here.get("key") || here.get("code") || here.get("card") || "");
  if (fromUrl){
    await handleUnlock(user.uid, fromUrl);
    cleanCardQueryFromUrl();
    return;
  }else if (here.get("k") || here.get("key") || here.get("code") || here.get("card")){
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

  // Upload / Drop (make whole area clickable)
  dropZone?.addEventListener("click", () => fileInput?.click());
  dropZone?.addEventListener("keydown", (e)=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); fileInput?.click(); }});
  uploadBtn?.addEventListener("click", ()=> fileInput.click());

  fileInput?.addEventListener("change", async (e)=>{
    const f = e.target.files?.[0];
    if (f){
      uploadBtn.textContent = `Choose Image — ${f.name}`;
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
      uploadBtn.textContent = `Choose Image — ${f.name}`;
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
