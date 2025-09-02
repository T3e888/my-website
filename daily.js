// daily.js v3 — Firebase daily reward (7 วันวนลูป)
(function(){
  if (!window.firebase || !window.auth || !window.db) return;

  // เด้งอัตโนมัติบนหน้าแรกหลังล็อกอินเท่านั้น
  const isLanding = /\/allcard\.html$/i.test(location.pathname);

  const pad = n => String(n).padStart(2,'0');
  const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const addDays = (d, days)=>{ const x=new Date(d); x.setDate(x.getDate()+days); return x; };

  const CARD_REWARD_ID = 'card30';
  const PLAN = [
    { type: 'points', amount: 2, label: '+2 🧠' },
    { type: 'points', amount: 3, label: '+3 🧠' },
    { type: 'card',   cardId: CARD_REWARD_ID, label: 'Card 30' },
    { type: 'points', amount: 2, label: '+2 🧠' },
    { type: 'points', amount: 3, label: '+3 🧠' },
    { type: 'points', amount: 2, label: '+2 🧠' },
    { type: 'combo',  amount: 2, cardId: CARD_REWARD_ID, label: '+2 🧠 + Card 30' },
  ];

  let autoOpenedOnce = false;

  auth.onAuthStateChanged((user)=>{
    if (!user) return;

    ensureModalShell();
    ensureFab();
    document.getElementById('open-daily-from-logo')?.addEventListener('click', openModal);

    if (isLanding && !autoOpenedOnce){
      autoOpenedOnce = true;
      readDailyState(user.uid).then(({ claimedToday })=>{
        if (!claimedToday) openModal();
        refreshPreview();
      });
    } else {
      refreshPreview();
    }
  });

  function ensureFab(){
    if (document.getElementById('daily-fab')) return;
    const fab = document.createElement('button');
    fab.id = 'daily-fab';
    fab.title = 'Daily Login Rewards';
    fab.innerHTML = '🎁<span class="sr">Daily</span>';
    document.body.appendChild(fab);
    fab.addEventListener('click', openModal);
  }

  function ensureModalShell(){
    if (document.getElementById('daily-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'daily-modal';
    modal.innerHTML = `
      <div class="panel">
        <button class="close-x" aria-label="Close">×</button>
        <h2>Daily Login Rewards</h2>
        <div class="daily-hero" id="daily-hero"></div>
        <div class="daily-strip" id="daily-strip"></div>
        <div class="daily-note">รับได้วันละครั้ง ข้ามวันรีเซ็ตรอบใหม่</div>
        <div class="daily-actions">
          <button class="daily-btn grey" id="daily-cancel">ปิด</button>
          <button class="daily-btn red"  id="daily-claim">รับรางวัล</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e)=>{ if (e.target.id==='daily-modal') closeModal(); });
    modal.querySelector('.close-x').addEventListener('click', closeModal);
    modal.querySelector('#daily-cancel').addEventListener('click', closeModal);
    modal.querySelector('#daily-claim').addEventListener('click', claimReward);
  }

  function openModal(){ document.getElementById('daily-modal')?.classList.add('show'); refreshPreview(); }
  function closeModal(){ document.getElementById('daily-modal')?.classList.remove('show'); }

  async function readDailyState(uid){
    const ref = db.collection('users').doc(uid);
    const s = await ref.get();
    const d = s.exists ? (s.data()||{}) : {};
    const daily = (d.daily && typeof d.daily==='object') ? d.daily : { last:null, streak:0 };
    const last   = daily.last || null;
    const streak = Number(daily.streak || 0);

    const today = ymd();
    const yesterday = ymd(addDays(new Date(), -1));
    const claimedToday = (last === today);

    const nextStreakIfClaim = (last === yesterday) ? streak + 1 : 1;
    const dayIdx = ((nextStreakIfClaim - 1) % 7 + 7) % 7;

    return { today, last, streak, claimedToday, dayIdx, nextStreakIfClaim };
  }

  async function refreshPreview(){
    const user = auth.currentUser;
    if (!user) return;

    const { claimedToday, dayIdx } = await readDailyState(user.uid);
    const hero  = document.getElementById('daily-hero');
    const strip = document.getElementById('daily-strip');
    const r = PLAN[dayIdx];

    if (hero){
      if (r.type === 'points')      hero.innerHTML = `<span class="emoji">🧠</span>${r.label}`;
      else if (r.type === 'card')   hero.innerHTML = `<span class="emoji">🃏</span>${r.label}`;
      else                          hero.innerHTML = `<span class="emoji">🎉</span>${r.label}`;
      if (claimedToday){
        hero.innerHTML += `<div style="font-size:1rem;color:#2e7d32;margin-top:6px">รับรางวัลวันนี้แล้ว</div>`;
      }
    }

    if (strip){
      strip.innerHTML = '';
      for (let i=0;i<7;i++){
        const ri = PLAN[i];
        const cell = document.createElement('div');
        cell.className = 'daily-cell';
        cell.innerHTML = `<div>${ri.label}</div><small>Day ${i+1}</small>`;
        if (i < dayIdx) cell.classList.add('claimed');
        if (i === dayIdx) cell.classList.add('today');
        strip.appendChild(cell);
      }
    }

    const btn = document.getElementById('daily-claim');
    if (btn) btn.disabled = claimedToday;
  }

  async function claimReward(){
    const user = auth.currentUser; if (!user) return;
    const uref = db.collection('users').doc(user.uid);

    try{
      const result = await db.runTransaction(async (tx)=>{
        const snap = await tx.get(uref);
        const data = snap.exists ? (snap.data()||{}) : {};
        const daily = (data.daily && typeof data.daily==='object') ? data.daily : { last:null, streak:0 };
        const last   = daily.last || null;
        const streak = Number(daily.streak || 0);

        const today = ymd();
        const yesterday = ymd(addDays(new Date(), -1));
        if (last === today) return { already:true };

        const nextStreak = (last === yesterday) ? streak + 1 : 1;
        const idx = ((nextStreak - 1) % 7 + 7) % 7;
        const reward = PLAN[idx];

        const upd = { daily: { last: today, streak: nextStreak } };
        if (reward.type === 'points'){
          upd.points = firebase.firestore.FieldValue.increment(reward.amount);
        } else if (reward.type === 'card'){
          upd.cards  = firebase.firestore.FieldValue.arrayUnion(reward.cardId);
        } else {
          upd.points = firebase.firestore.FieldValue.increment(reward.amount);
          upd.cards  = firebase.firestore.FieldValue.arrayUnion(reward.cardId);
        }

        tx.set(uref, upd, { merge: true });
        return { already:false, reward };
      });

      if (result.already){
        toast('วันนี้รับแล้ว');
      }else{
        const r = result.reward;
        if (r.type === 'points')      toast(`+${r.amount} Brain points 🎉`);
        else if (r.type === 'card')   toast(`ได้ Card 30 🎉`);
        else                          toast(`+${r.amount} Brain points + Card 30 🎉`);
      }

      await refreshPreview();
      setTimeout(()=> closeModal(), 700);
    }catch(e){
      console.error(e);
      toast('รับรางวัลไม่สำเร็จ ลองอีกครั้ง');
    }
  }

  function toast(t){
    let el = document.getElementById('toast');
    if (!el){
      el = document.createElement('div');
      el.id = 'toast';
      Object.assign(el.style,{
        position:'fixed',left:'50%',bottom:'18px',transform:'translateX(-50%)',
        background:'#333',color:'#fff',padding:'10px 14px',borderRadius:'10px',
        zIndex:'3000',opacity:'0',transition:'opacity .2s'
      });
      document.body.appendChild(el);
    }
    el.textContent = t;
    requestAnimationFrame(()=> el.style.opacity='1');
    setTimeout(()=> el.style.opacity='0', 1600);
  }
})();
