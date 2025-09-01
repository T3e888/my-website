// scan.js — QR scanning + card award
const auth = firebase.auth();
const db   = firebase.firestore();

const $ = (id)=> document.getElementById(id);
const toast = (t)=>{
  const el = $("toast"); el.textContent = t; el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"), 1600);
};
const showModal = (html)=>{
  const m = $("modal");
  m.innerHTML = `<div class="modal-content">${html}<br><button class="btn btn-red ok">OK</button></div>`;
  m.classList.add("active");
  m.querySelector(".ok").onclick = ()=> m.classList.remove("active");
};

// Sidebar (same as other pages)
(function setupSidebar(){
  $("menu-toggle")?.addEventListener("click", ()=>{
    $("sidebar").classList.add("open"); $("overlay").classList.add("active");
  });
  $("close-sidebar")?.addEventListener("click", ()=>{
    $("sidebar").classList.remove("open"); $("overlay").classList.remove("active");
  });
  $("overlay")?.addEventListener("click", ()=>{
    $("sidebar").classList.remove("open"); $("overlay").classList.remove("active");
  });
  $("logout-link")?.addEventListener("click", (e)=>{
    e.preventDefault(); auth.signOut().then(()=>location.href="login.html");
  });
})();

let currentUid = null;
let camStream  = null;
let rafId      = 0;

auth.onAuthStateChanged((user)=>{
  if (!user){ location.href = "login.html"; return; }
  currentUid = user.uid;

  // UI binds
  $("pickBtn").addEventListener("click", ()=> $("file").click());
  $("file").addEventListener("change", onPickImage);
  $("startCamBtn").addEventListener("click", startCamera);
  $("stopCamBtn").addEventListener("click", stopCamera);

  // Drag&drop
  const drop = document.querySelector(".drop");
  ["dragenter","dragover"].forEach(evt=> drop.addEventListener(evt, e=>{ e.preventDefault(); e.dataTransfer.dropEffect="copy"; }));
  drop.addEventListener("drop", (e)=>{
    e.preventDefault();
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  });
});

async function onPickImage(e){
  const f = e.target.files[0];
  if (!f) return;
  await handleFile(f);
  e.target.value = ""; // allow picking same file again
}

async function handleFile(file){
  // quick filename fallback (card12.png)
  const idFromName = extractCardFromFilename(file.name);
  if (idFromName){
    await awardCard(idFromName);
    return;
  }

  // decode QR from image
  const dataUrl = await fileToDataURL(file);
  const cardId = await decodeQrToCardId(dataUrl);
  if (!cardId){
    showModal(`Invalid QR. Expect a link that has <code>?card=cardX</code> or a filename like <code>cardX.png</code>`);
    return;
  }
  await awardCard(cardId);
}

function fileToDataURL(file){
  return new Promise((res, rej)=>{
    const fr = new FileReader();
    fr.onload = ()=> res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

async function decodeQrToCardId(dataUrl){
  const img = new Image();
  img.src = dataUrl;
  await img.decode().catch(()=>{});
  const canvas = $("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width  = img.naturalWidth  || img.width;
  canvas.height = img.naturalHeight || img.height;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: "dontInvert" });
  if (!code || !code.data) return null;
  return extractCardFromText(code.data);
}

function extractCardFromFilename(name){
  const m = String(name||"").match(/(card[_\- ]?\d+)/i);
  return m ? m[1].toLowerCase().replace(/[_\- ]/g,"") : null;
}

function extractCardFromText(text){
  const t = String(text||"").trim();

  // Try URL parsing first
  try{
    const u = new URL(t);
    const viaParam = (u.searchParams.get("card") || u.searchParams.get("c") || "").toLowerCase();
    if (viaParam && /^card\d+$/.test(viaParam)) return viaParam;
    const last = u.pathname.split("/").pop() || "";
    const mFile = last.match(/(card\d+)\.(png|jpg|jpeg)/i);
    if (mFile) return mFile[1].toLowerCase();
  }catch{ /* not a URL */ }

  // Fallback: any "card123" inside the text
  const m = t.match(/card[_\- ]?(\d+)/i);
  if (m) return `card${m[1]}`;

  return null;
}

/* ---------- Camera mode ---------- */
async function startCamera(){
  try{
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  }catch(e){
    showModal("Camera permission denied. You can still use Choose Image.");
    return;
  }
  $("camWrap").classList.remove("hidden");
  const video = $("video");
  video.srcObject = camStream;
  await video.play();
  scanLoop();
}
function stopCamera(){
  cancelAnimationFrame(rafId);
  if (camStream){ camStream.getTracks().forEach(t=>t.stop()); camStream = null; }
  $("camWrap").classList.add("hidden");
}
function scanLoop(){
  const video = $("video");
  const canvas = $("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: "dontInvert" });
  if (code && code.data){
    stopCamera();
    const cardId = extractCardFromText(code.data);
    if (cardId) {
      awardCard(cardId);
      return;
    } else {
      showModal(`Invalid QR. Expect a link that has <code>?card=cardX</code>`);
    }
  }
  rafId = requestAnimationFrame(scanLoop);
}

/* ---------- Award card ---------- */
async function awardCard(cardId){
  cardId = String(cardId||"").toLowerCase().replace(/[_\- ]/g,"");
  if (!/^card\d+$/.test(cardId)){
    showModal(`Invalid card id: <b>${cardId||"(empty)"}</b>`);
    return;
  }
  if (!currentUid){ toast("Please sign in again."); return; }

  const uref = db.collection("users").doc(currentUid);
  try{
    const result = await db.runTransaction(async (tx)=>{
      const s = await tx.get(uref);
      const d = s.exists ? (s.data()||{}) : {};
      const cards = Array.isArray(d.cards) ? d.cards : [];
      if (cards.includes(cardId)) return { already:true };

      tx.set(uref, {
        cards: firebase.firestore.FieldValue.arrayUnion(cardId)
      }, { merge: true });

      return { already:false };
    });

    if (result.already){
      showModal(`คุณมี <b>${cardId}</b> อยู่แล้ว`);
    } else {
      showModal(`
        ได้รับการ์ด <b>${cardId}</b> เรียบร้อย!<br><br>
        <img src="assets/cards/${cardId}.png" alt="${cardId}"
             onerror="this.onerror=null;this.src='assets/cards/${cardId}.jpg'"
             style="width:160px;height:auto;border-radius:12px">
      `);
      toast("Card added to your collection");
    }
  }catch(e){
    console.error(e);
    showModal("ไม่สามารถบันทึกการ์ดได้ กรุณาลองใหม่อีกครั้ง");
  }
    }
