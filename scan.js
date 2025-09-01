// scan.js — สแกน QR การ์ด (สไตล์เดิม)

const auth = firebase.auth();
const db   = firebase.firestore();

const $ = (id) => document.getElementById(id);

let currentUid = null;
let stream = null;
let usingDeviceId = null;
let torchOn = false;
let rafId = null;
let lastCode = "";
let lastAt = 0;

// ---------- sidebar ----------
function setupSidebar(){
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
}

// ---------- modal ----------
function showModal(msg, cb){
  const modal = $("modal");
  modal.innerHTML = `<div class="modal-content">${msg}<br><button class="ok">ตกลง</button></div>`;
  modal.classList.add("active");
  modal.querySelector(".ok").onclick = ()=>{ modal.classList.remove("active"); cb?.(); };
}

// ---------- camera helpers ----------
async function listCams(){
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(d => d.kind === "videoinput");
}

async function startCam(deviceId){
  stopCam();

  const constraints = deviceId
    ? { video: { deviceId: { exact: deviceId } } }
    : { video: { facingMode: { ideal: "environment" } } };

  stream = await navigator.mediaDevices.getUserMedia(constraints);
  const video = $("preview");
  video.srcObject = stream;
  await video.play();

  usingDeviceId = stream.getVideoTracks()[0].getSettings().deviceId || deviceId || null;

  // torch capability
  const track = stream.getVideoTracks()[0];
  const caps = track.getCapabilities?.() || {};
  const btnTorch = $("btnTorch");
  if (caps.torch){
    btnTorch.disabled = false;
  }else{
    btnTorch.disabled = true;
  }

  loopScan();
}

function stopCam(){
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  const video = $("preview");
  if (video) video.pause();
  if (stream){
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
}

async function switchCam(){
  const cams = await listCams();
  if (!cams.length) return;
  if (!usingDeviceId){
    await startCam(cams[0].deviceId);
    return;
  }
  const idx = cams.findIndex(c => c.deviceId === usingDeviceId);
  const next = cams[(idx + 1) % cams.length];
  await startCam(next.deviceId);
}

async function toggleTorch(){
  if (!stream) return;
  const track = stream.getVideoTracks()[0];
  const caps = track.getCapabilities?.() || {};
  if (!caps.torch) return;
  torchOn = !torchOn;
  try{
    await track.applyConstraints({ advanced: [{ torch: torchOn }] });
  }catch(e){
    console.warn("Torch toggle failed:", e);
  }
}

// ---------- parsing & UI ----------
function parseCardId(text){
  if (!text) return null;
  // examples it will accept: "card1", "CARD_25", "...?card=7", "card=12"
  const m = String(text).toLowerCase().match(/card[_:=\s-]?(\d{1,3})/);
  if (m) return "card" + Number(m[1]);
  return null;
}

function renderResult(raw, cardId){
  const box = $("resultBox");
  if (!cardId){
    box.innerHTML = `<div class="hint">ไม่รู้จักรูปแบบข้อมูล: <small>${raw || ""}</small></div>`;
    return;
  }
  const n = Number(cardId.replace("card",""));
  box.innerHTML = `
    <div class="thumb">
      <img src="assets/cards/${cardId}.png" onerror="this.onerror=null;this.src='assets/cards/${cardId}.jpg'">
    </div>
    <div class="meta">
      พบ <b>การ์ด ${n}</b>
      <small>${cardId}</small>
    </div>
    <div class="actions">
      <button class="btn btn-red" id="btnAdd">เพิ่มเข้าคลัง</button>
    </div>
  `;
  $("btnAdd").onclick = ()=> addCardToUser(cardId);
}

async function addCardToUser(cardId){
  if (!currentUid) return showModal("กรุณาเข้าสู่ระบบอีกครั้ง");
  const uref = db.collection("users").doc(currentUid);
  try{
    await uref.set({ cards: firebase.firestore.FieldValue.arrayUnion(cardId) }, { merge: true });
    // log เล็กน้อย
    try{
      await db.collection("scanLog").add({
        uid: currentUid, cardId, createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }catch(e){/* ignore */}
    showModal(`✅ เพิ่ม <b>${cardId}</b> เข้าคลังเรียบร้อย`);
  }catch(e){
    showModal(`❌ เพิ่มการ์ดไม่สำเร็จ<br><small>${e?.code || ""} ${e?.message || e}</small>`);
  }
}

// ---------- scanning loop ----------
async function loopScan(){
  const video = $("preview");
  const canvas = $("capture");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const hasBarcode = ("BarcodeDetector" in window);
  let detector = null;
  if (hasBarcode){
    try{
      detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    }catch{ detector = null; }
  }

  const step = async ()=>{
    if (!stream){ rafId = null; return; }

    const now = Date.now();
    // ป้องกันอ่านซ้ำถี่ ๆ
    if (now - lastAt > 120){
      if (detector){
        try{
          const codes = await detector.detect(video);
          if (codes && codes.length){
            const value = codes[0].rawValue || "";
            handleDecode(value);
          }
        }catch(e){ /* ignore frame */ }
      }else if (window.jsQR){
        // fallback jsQR
        const vw = video.videoWidth || 0, vh = video.videoHeight || 0;
        if (vw && vh){
          canvas.width = vw; canvas.height = vh;
          ctx.drawImage(video, 0, 0, vw, vh);
          const img = ctx.getImageData(0, 0, vw, vh);
          const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
          if (code && code.data) handleDecode(code.data);
        }
      }
      lastAt = now;
    }
    rafId = requestAnimationFrame(step);
  };
  rafId = requestAnimationFrame(step);
}

function handleDecode(text){
  if (!text) return;
  if (text === lastCode) return;      // กันเด้งซ้ำ
  lastCode = text;
  const cardId = parseCardId(text);
  renderResult(text, cardId);
}

// ---------- start ----------
auth.onAuthStateChanged(async (user)=>{
  if (!user){ location.href = "login.html"; return; }
  currentUid = user.uid;
  setupSidebar();

  // ปุ่มควบคุม
  $("btnStart").onclick = ()=> startCam(usingDeviceId).catch(e=> showModal("ไม่สามารถเปิดกล้องได้<br><small>"+(e.message||e)+"</small>"));
  $("btnStop").onclick  = ()=> stopCam();
  $("btnSwitch").onclick= ()=> switchCam().catch(e=> showModal("สลับกล้องไม่ได้<br><small>"+(e.message||e)+"</small>"));
  $("btnTorch").onclick = ()=> toggleTorch();

  // เริ่มอัตโนมัติถ้าอนุญาต
  try{ await startCam(); }catch(e){ console.warn("autostart cam failed:", e); }
});
