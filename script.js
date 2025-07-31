// ตรวจสอบล็อกอินก่อนเข้าแต่ละหน้า
(function() {
  const path = location.pathname.split('/').pop();
  const protectedPages = ['index.html','scan.html','mission.html'];
  if (protectedPages.includes(path) && !localStorage.getItem('token')) {
    location.href = `login.html?redirect=${path}`;
  }
})();

// sidebar toggle
function toggleSidebar() {
  document.querySelector('.sidebar')?.classList.toggle('open');
}

// show username
(function(){
  document.getElementById('usernameDisplay')?.textContent = localStorage.getItem('token')||'';
})();

// logout
document.getElementById('logoutLink')?.addEventListener('click', e=>{
  e.preventDefault();
  localStorage.removeItem('token');
  location.href='login.html';
});

// close popup
document.getElementById('popupClose')?.addEventListener('click', ()=>{
  document.getElementById('cardPopup').style.display='none';
});

// ===== login.html =====
if (location.pathname.endsWith('login.html')) {
  document.getElementById('btnLogin')?.addEventListener('click', ()=>{
    const email = document.getElementById('loginEmail').value.trim();
    if (!email) { alert('กรุณากรอกอีเมล'); return; }
    localStorage.setItem('token', email);
    const redirect = new URLSearchParams(location.search).get('redirect');
    location.href = redirect||'index.html';
  });
}

// ===== register.html =====
if (location.pathname.endsWith('register.html')) {
  document.getElementById('btnRegister')?.addEventListener('click', ()=>{
    const email = document.getElementById('regEmail').value.trim();
    const pw    = document.getElementById('regPassword').value;
    if (!email||!pw) { alert('กรุณากรอกให้ครบ'); return; }
    const users = JSON.parse(localStorage.getItem('users')||'{}');
    if (users[email]) { alert('มีบัญชีนี้แล้ว'); return; }
    users[email]=pw;
    localStorage.setItem('users', JSON.stringify(users));
    alert('สมัครสำเร็จ');
    location.href='login.html';
  });
}

// ===== index.html =====
if (location.pathname.endsWith('index.html')) {
  const user = localStorage.getItem('token');
  const key = user+'_cards';
  const unlocked = JSON.parse(localStorage.getItem(key)||'{}');
  const all = ['card1','card2'];
  const container = document.getElementById('collection');
  container.innerHTML='';
  all.forEach(c=>{
    const slot=document.createElement('div'); slot.className='card-slot';
    const img=document.createElement('img');
    img.src=`assets/cards/${c}.png`; img.style.width='120px';
    if (!unlocked[c]) { img.classList.add('locked'); slot.classList.add('locked'); }
    slot.appendChild(img);
    if (unlocked[c]>1) {
      const sp=document.createElement('span');
      sp.className='count-label'; sp.textContent=`×${unlocked[c]}`;
      slot.appendChild(sp);
    }
    container.appendChild(slot);
  });
}

// ===== scan.html =====
if (location.pathname.endsWith('scan.html')) {
  const user = localStorage.getItem('token');
  const key = user+'_cards';
  let unlocked = JSON.parse(localStorage.getItem(key)||'{}');
  const all = ['card1','card2'];
  let stream,interval,detector;
  const video=document.getElementById('video'),
        camBtn=document.getElementById('cameraBtn'),
        stopBtn=document.getElementById('stopBtn'),
        fileIn=document.getElementById('fileInput');
  function handle(code) {
    clearInterval(interval);
    stream?.getTracks().forEach(t=>t.stop());
    video.style.display='none'; stopBtn.style.display='none'; camBtn.style.display='inline-block';
    let k = all.includes(code)?code:code.startsWith('card')?code:null;
    if (!k) return alert('Invalid QR');
    const isNew = !unlocked[k];
    unlocked[k] = (unlocked[k]||0)+1;
    localStorage.setItem(key, JSON.stringify(unlocked));
    document.getElementById('popupCardImg').src=`assets/cards/${k}.png`;
    document.getElementById('popupCardName').textContent=k;
    document.getElementById('popupTitle').textContent=isNew?'New Card Unlocked!':'Card Already Collected';
    document.getElementById('cardPopup').style.display='flex';
  }
  camBtn.addEventListener('click', async ()=>{
    if (!('BarcodeDetector' in window)) return alert('ไม่รองรับ');
    detector=new BarcodeDetector({formats:['qr_code']});
    try{ stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}); }
    catch{ return alert('เข้ากล้องไม่ได้'); }
    video.srcObject=stream; video.style.display='block';
    stopBtn.style.display='inline-block'; camBtn.style.display='none';
    const cnv=document.createElement('canvas'),ctx=cnv.getContext('2d');
    interval=setInterval(async ()=>{
      if(video.readyState===video.HAVE_ENOUGH_DATA){
        cnv.width=video.videoWidth; cnv.height=video.videoHeight;
        ctx.drawImage(video,0,0,cnv.width,cnv.height);
        const codes=await detector.detect(cnv);
        if(codes.length) handle(codes[0].rawValue);
      }
    },500);
  });
  stopBtn.addEventListener('click', ()=>{
    clearInterval(interval); stream?.getTracks().forEach(t=>t.stop());
    video.style.display='none'; stopBtn.style.display='none'; camBtn.style.display='inline-block';
  });
  fileIn.addEventListener('change', e=>{
    const f=e.target.files[0];
    if (!f||!('BarcodeDetector' in window)) return alert('ไม่พบ QR');
    detector=new BarcodeDetector({formats:['qr_code']});
    const img=new Image();
    img.onload=async ()=>{
      const codes=await detector.detect(img);
      codes.length?handle(codes[0].rawValue):alert('No QR found');
    };
    new FileReader().addEventListener('load', e2=>img.src=e2.target.result);
  });
}

// ===== mission.html =====
if (location.pathname.endsWith('mission.html')) {
  const user=localStorage.getItem('token');
  const key=user+'_cards';
  let unlocked=JSON.parse(localStorage.getItem(key)||'{}');
  const all=['card1','card2'];
  const qData={question:"F ใน FAST ย่อมาจากอะไร?",options:["Finger","Face","Foot","Food"],answerIndex:1};
  const tKey=user+'_lastQuizTime', sKey=user+'_lastQuizStatus';
  const last=localStorage.getItem(tKey), status=localStorage.getItem(sKey);
  const containerBtn=document.getElementById('optionsContainer');
  if (all.every(c=>unlocked[c])) {
    document.getElementById('quiz-section').style.display='none';
    document.getElementById('wait-section').style.display='block';
    document.getElementById('waitMsg').textContent="คุณสะสมครบแล้ว!";
    return;
  }
  if (last && Date.now()-parseInt(last)<86400000) {
    document.getElementById('quiz-section').style.display='none';
    document.getElementById('wait-section').style.display='block';
    document.getElementById('waitMsg').textContent=status==='correct'
      ?"ทำแบบทดสอบแล้ว โปรดกลับมาใหม่พรุ่งนี้."
      :"ตอบผิดวันนี้ ลองใหม่หลัง 24 ชม.";
    return;
  }
  document.getElementById('question-text').textContent=qData.question;
  containerBtn.innerHTML='';
  qData.options.forEach((opt,i)=>{
    const b=document.createElement('button');
    b.className='option-btn'; b.textContent=opt;
    b.onclick=()=>{
      document.querySelectorAll('.option-btn').forEach(x=>x.disabled=true);
      const ok = i===qData.answerIndex;
      b.classList.add(ok?'correct':'wrong');
      localStorage.setItem(tKey,Date.now().toString());
      localStorage.setItem(sKey,ok?'correct':'wrong');
      if(ok){
        const rem=all.filter(c=>!unlocked[c]);
        const newC=rem[Math.floor(Math.random()*rem.length)];
        unlocked[newC]=1;
        localStorage.setItem(key,JSON.stringify(unlocked));
        document.getElementById('popupCardImg').src=`assets/cards/${newC}.png`;
        document.getElementById('popupCardName').textContent=newC;
        document.getElementById('cardPopup').style.display='flex';
      } else {
        const msg=document.getElementById('resultMsg');
        msg.style.display='block'; msg.textContent="ตอบไม่ถูก ต้องรอ 24 ชม.";
      }
    };
    containerBtn.appendChild(b);
  });
      }
