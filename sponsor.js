// sponsors.js — self-contained, no dependencies, safe to include on every page
(function () {
  'use strict';
  if (window.__sponsorsLoaded) return; // idempotent
  window.__sponsorsLoaded = true;

  // ---- Static list (no network calls) ----
  const PARTNERS = [
    { name: 'Thai Red Cross',     file: 'redcross.png' },
    { name: 'Siriraj Hospital',   file: 'siriraj.png' },
    { name: 'TCF Stroke Hero',    file: 'tcf-stroke-hero.png' },
    { name: 'Thaicom Foundation', file: 'thaicom-foundation.png' },
  ];
  const ASSET_DIR = 'assets/partners/';

  // ---- Inject tiny, namespaced CSS (no edits to your CSS files) ----
  (function injectCSS(){
    if (document.getElementById('sponsor-css')) return;
    const css = `
      .sponsor-fab{position:fixed;top:60px;right:12px;z-index:1199;width:44px;height:44px;border:none;border-radius:12px;background:#fff;box-shadow:0 4px 12px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;cursor:pointer}
      .sponsor-fab:active{transform:scale(.98)}
      .sponsor-fab svg{width:24px;height:24px;fill:#e53935}
      #sponsor-modal.sponsor-modal{position:fixed;inset:0;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.45);z-index:1500}
      #sponsor-modal.sponsor-modal[data-open="1"]{display:flex}
      .sponsor-modal .sponsor-sheet{background:#fff;width:min(560px,96vw);border-top-left-radius:18px;border-top-right-radius:18px;padding:14px 14px 10px;box-shadow:0 -12px 32px rgba(0,0,0,.18)}
      @media (min-width:640px){#sponsor-modal.sponsor-modal{align-items:center}.sponsor-modal .sponsor-sheet{border-radius:16px}}
      .sponsor-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
      .sponsor-title{font-weight:900;color:#b71c1c}
      .sponsor-close{border:none;background:transparent;font-size:20px;line-height:1;cursor:pointer;padding:6px}
      .sponsor-grid{display:grid;grid-template-columns:64px 1fr;gap:12px;padding:8px 2px 8px}
      .sponsor-item{display:contents}
      .sponsor-logo{width:64px;height:64px;border-radius:12px;object-fit:contain;border:1px solid #eee;padding:6px;background:#fff}
      .sponsor-name{display:flex;align-items:center;font-weight:800;color:#333}
      .sponsor-actions{text-align:center;margin-top:10px}
      .sponsor-ok{background:#e53935;color:#fff;border:none;border-radius:10px;font-weight:800;padding:10px 16px;cursor:pointer}
    `;
    const s = document.createElement('style');
    s.id = 'sponsor-css';
    s.textContent = css;
    document.head.appendChild(s);
  })();

  // ---- Ensure hooks exist (auto-create if you forget to add them) ----
  function ensureHooks(){
    let fab = document.getElementById('sponsor-fab');
    if (!fab) {
      fab = document.createElement('button');
      fab.id = 'sponsor-fab';
      fab.className = 'sponsor-fab';
      fab.type = 'button';
      fab.setAttribute('aria-label', 'Partners');
      fab.title = 'Partners';
      fab.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
      document.body.appendChild(fab);
    }
    let modal = document.getElementById('sponsor-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'sponsor-modal';
      modal.className = 'modal sponsor-modal';
      modal.setAttribute('aria-hidden', 'true');
      document.body.appendChild(modal);
    }
    // On pages with your fixed corner logo, drop the FAB slightly lower
    if (document.querySelector('.corner-logo')) { fab.style.top = '64px'; }
    return { fab, modal };
  }

  // ---- Build modal content ----
  function buildModal(modal){
    const sheet = document.createElement('div');
    sheet.className = 'sponsor-sheet';
    sheet.setAttribute('role','dialog');
    sheet.setAttribute('aria-modal','true');
    sheet.setAttribute('aria-labelledby','sponsorTitle');
    sheet.tabIndex = -1;

    sheet.innerHTML = `
      <div class="sponsor-header">
        <div class="sponsor-title" id="sponsorTitle">Sponsors &amp; Partners</div>
        <button type="button" class="sponsor-close" aria-label="Close">×</button>
      </div>
      <div class="sponsor-grid">
        ${PARTNERS.map(p => `
          <div class="sponsor-item">
            <img class="sponsor-logo" src="${ASSET_DIR + p.file}" alt="${p.name}">
            <div class="sponsor-name">${p.name}</div>
          </div>`).join('')}
      </div>
      <div class="sponsor-actions"><button type="button" class="sponsor-ok">OK</button></div>
    `;
    modal.innerHTML = '';
    modal.appendChild(sheet);
    return sheet;
  }

  let lastTrigger = null;

  // ---- Open/close + focus trap ----
  function openModal(triggerEl){
    lastTrigger = triggerEl || document.activeElement || null;
    const { modal } = ensureHooks();
    const sheet = buildModal(modal);
    modal.setAttribute('data-open','1');
    modal.removeAttribute('aria-hidden');

    const focusables = sheet.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
    const first = focusables[0], last = focusables[focusables.length-1];

    function trap(e){
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    }
    function onKey(e){ if (e.key === 'Escape') close(); else trap(e); }
    modal.addEventListener('keydown', onKey);

    function close(){
      modal.removeAttribute('data-open');
      modal.setAttribute('aria-hidden','true');
      modal.innerHTML = '';
      modal.removeEventListener('keydown', onKey);
      try { lastTrigger && lastTrigger.focus(); } catch(_){}
    }

    sheet.querySelector('.sponsor-close').addEventListener('click', close);
    sheet.querySelector('.sponsor-ok').addEventListener('click', close);
    modal.addEventListener('click', (e)=>{ if (e.target === modal) close(); });

    setTimeout(()=> first?.focus(), 0);
  }

  // ---- Bind triggers ----
  function init(){
    const { fab } = ensureHooks();
    const link = document.getElementById('menu-partners');
    fab.addEventListener('click', ()=> openModal(fab));
    link && link.addEventListener('click', (e)=>{ e.preventDefault(); openModal(link); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
