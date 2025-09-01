/* daily.js — Daily Login Rewards (7-day cycle)
   Reward plan:
   D1: +2 pts; D2: +3; D3: event card; D4: +2; D5: +3; D6: +2; D7: +2 + event card
   Data in users/{uid}:
     points: number
     cards: string[]
     daily: { last: 'YYYY-MM-DD', streak: number }
*/

(function(){
  // Require Firebase to be initialized by the page
  if (!window.firebase || !window.auth || !window.db) return;

  // Utils
  const pad = (n)=> String(n).padStart(2,'0');
  const ymd = (d = new Date())=>{
    // Local calendar day
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  };
  const addDays = (d, days)=>{ const x = new Date(d); x.setDate(x.getDate()+days); return x; };

  // Rewards table (index 0..6 for days 1..7)
  const PLAN = [
    { type: 'points', amount: 2, label: '+2 🧠' },
    { type: 'points', amount: 3, label: '+3 🧠' },
    { type: 'card',   cardId: 'card_event', label: 'EVENT' },
    { type: 'points', amount: 2, label: '+2 🧠' },
    { type: 'points', amount: 3, label: '+3 🧠' },
    { type: 'points', amount: 2, label: '+2 🧠' },
    { type: 'combo',  amount: 2, cardId: 'card_event', label: '+2 🧠 + EVENT' },
  ];

  // Build FAB + modal once user is signed in
  auth.onAuthStateChanged((user)=>{
    if (!user) return;

    // FAB
    if (!document.getElementById('daily-fab')){
      const fab = document.createElement('button');
      fab.id = 'daily-fab';
      fab.title = 'Daily Login Rewards';
      fab.innerHTML = '🎁<span class="sr">Daily</span>';
      document.body.appendChild(fab);
      fab.addEventListener('click', openModal);
    }

    // Modal shell
    if (!document.getElementById('daily-modal')){
      const modal = document.createElement('div');
      modal.id = 'daily-modal';
      modal.innerHTML = `
        <div class="panel">
          <button class="close-x" aria-label="Close">×</button>
          <h2>Daily Login Rewards</h2>
          <div class="daily-hero" id="daily-hero"></div>
          <div class="daily-strip" id="daily-strip"></div>
          <div class="daily-note">Claim once per calendar day. Missing a day resets the cycle.</div>
          <div class="daily-actions">
            <button class="daily-btn grey" id="daily-cancel">Close</button>
            <button class="daily-btn red" id="daily-claim">Claim Reward</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', (e)=>{
        if (e.target.id === 'daily-modal') closeModal();
      });
      modal.querySelector('.close-x').addEventListener('click', closeModal);
      modal.querySelector('#daily-cancel').addEventListener('click', closeModal);
      modal.querySelector('#daily-claim').addEventListener('click', claimReward);
    }

    // When signed in, we can update the UI preview
    refreshPreview();
  });

  function openModal(){ document.getElementById('daily-modal')?.classList.add('show'); refreshPreview(); }
  function closeModal(){ document.getElementById('daily-modal')?.classList.remove('show'); }

  async function readDailyState(uid){
    const ref = db.collection('users').doc(uid);
    const s = await ref.get();
    const d = s.exists ? (s.data()||{}) : {};
    // Default structure
    const daily = d.daily && typeof d.daily==='object' ? d.daily : { last: null, streak: 0 };
    const last = daily.last || null;
    const streak = Number(daily.streak||0);

    // Compute today/next day relationship
    const today = ymd();
    const yesterday = ymd(addDays(new Date(), -1));
    const claimedToday = (last === today);
    const eligible = !claimedToday;  // can claim again today only if not claimed

    // If last is yesterday, continuing streak, else reset on claim
    let nextStreakIfClaim = (last === yesterday) ? streak + 1 : 1;

    // Day index in 7-cycle
    const dayIdx = ((nextStreakIfClaim - 1) % 7 + 7) % 7; // 0..6

    return { today, last, streak, claimedToday, eligible, dayIdx, nextStreakIfClaim };
  }

  async function refreshPreview(){
    const user = auth.currentUser;
    if (!user) return;

    const { claimedToday, dayIdx } = await readDailyState(user.uid);

    // Hero
    const hero = document.getElementById('daily-hero');
    if (hero){
      const r = PLAN[dayIdx];
      if (r.type === 'points'){
        hero.innerHTML = `<span class="emoji">🧠</span>${r.label}`;
      } else if (r.type === 'card'){
        hero.innerHTML = `<span class="emoji">🃏</span>Event Card`;
      } else { // combo
        hero.innerHTML = `<span class="emoji">🎉</span>${r.label}`;
      }
      if (claimedToday){
        hero.innerHTML += `<div style="font-size:1rem;color:#2e7d32;margin-top:6px">Already claimed today</div>`;
      }
    }

    // Strip 7 days
    const strip = document.getElementById('daily-strip');
    if (strip){
      strip.innerHTML = '';
      for (let i=0;i<7;i++){
        const r = PLAN[i];
        const cell = document.createElement('div');
        cell.className = 'daily-cell';
        cell.innerHTML = `<div>${r.label}</div><small>Day ${i+1}</small>`;
        if (i < dayIdx) cell.classList.add('claimed');
        if (i === dayIdx) cell.classList.add('today');
        strip.appendChild(cell);
      }
    }

    // Enable/disable the claim button
    const btn = document.getElementById('daily-claim');
    if (btn) btn.disabled = claimedToday;
  }

  async function claimReward(){
    const user = auth.currentUser;
    if (!user) return;

    const uref = db.collection('users').doc(user.uid);

    try{
      const result = await db.runTransaction(async (tx)=>{
        const snap = await tx.get(uref);
        const data = snap.exists ? (snap.data()||{}) : {};
        const daily = (data.daily && typeof data.daily==='object') ? data.daily : { last:null, streak:0 };
        const last   = daily.last || null;
        const streak = Number(daily.streak || 0);

        const pad = n => String(n).padStart(2,'0');
        const today = (()=>{ const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; })();
        const ymd = (d)=> `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
        const yesterday = (()=>{ const d=new Date(); d.setDate(d.getDate()-1); return ymd(d); })();

        if (last === today){
          return { already:true, reward:null };
        }

        const nextStreak = (last === yesterday) ? streak + 1 : 1;
        const idx = ((nextStreak - 1) % 7 + 7) % 7;
        const reward = PLAN[idx];

        const updates = { daily: { last: today, streak: nextStreak } };

        if (reward.type === 'points'){
          updates.points = firebase.firestore.FieldValue.increment(reward.amount);
        } else if (reward.type === 'card'){
          updates.cards = firebase.firestore.FieldValue.arrayUnion(reward.cardId);
        } else { // combo
          updates.points = firebase.firestore.FieldValue.increment(reward.amount);
          updates.cards  = firebase.firestore.FieldValue.arrayUnion(reward.cardId);
        }

        tx.set(uref, updates, { merge: true });
        return { already:false, reward };
      });

      if (result.already){
        toast('You already claimed today.');
      }else{
        const r = result.reward;
        if (r.type === 'points'){
          toast(`+${r.amount} Brain points 🎉`);
        } else if (r.type === 'card'){
          toast(`Got an EVENT card 🎉`);
        } else {
          toast(`+${r.amount} Brain points + EVENT card 🎉`);
        }
      }

      await refreshPreview();
      setTimeout(()=> document.getElementById('daily-modal')?.classList.remove('show'), 700);

    }catch(e){
      console.error(e);
      toast('Claim failed, please try again.');
    }
  }

  // Tiny toast (reuses #toast if present)
  function toast(t){
    let el = document.getElementById('toast');
    if (!el){
      el = document.createElement('div');
      el.id = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = t;
    el.classList.add('show');
    setTimeout(()=> el.classList.remove('show'), 1600);
  }
})();
