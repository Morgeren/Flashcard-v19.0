
/* V4 presentation layer: preserves existing app logic and local storage keys. */
(function(){
  const $ = id => document.getElementById(id);
  const root = document.documentElement;
  const legacyHeader = document.querySelector('.header-actions');
  const topbar = document.querySelector('.topbar');
  const hiddenTheme = $('themeToggle');
  if (topbar && legacyHeader && !$('.v4-header-actions')) {
    const actions = document.createElement('div'); actions.className='v4-header-actions';
    const theme = document.createElement('button'); theme.type='button'; theme.id='v4ThemeButton'; theme.setAttribute('aria-label','Ganti tema tampilan');
    theme.addEventListener('click',()=>{ const nowLight=!root.classList.contains('light-theme'); root.classList.toggle('light-theme',nowLight); root.classList.toggle('dark-theme',!nowLight); try{if(typeof studyPrefs!=='undefined'){studyPrefs.theme=nowLight?'light':'dark';save(STORAGE.prefs,studyPrefs);}}catch(e){} if(hiddenTheme){hiddenTheme.textContent=nowLight?'Tema gelap':'Tema terang';hiddenTheme.setAttribute('aria-pressed',String(!nowLight));} syncThemeLabel(); });
    const details = document.createElement('details'); details.className='v4-settings';
    const summary = document.createElement('summary'); summary.textContent='Pengaturan';
    const menu = document.createElement('div'); menu.className='v4-settings-menu';
    const ids = ['exportDatasetBtn','exportProgressBtn','restoreProgressBtn','importBtn','audioPauseBtn','audioStopBtn'];
    ids.forEach(id=>{const el=$(id); if(el) menu.appendChild(el);});
    ['importFile','restoreProgressFile'].forEach(id=>{const el=$(id); if(el) menu.appendChild(el);});
    details.append(summary,menu); actions.append(theme,details); topbar.append(actions);
    document.addEventListener('click',e=>{if(!details.contains(e.target))details.open=false;});
  }
  function syncThemeLabel(){const light=root.classList.contains('light-theme');root.classList.toggle('dark-theme',!light);const b=$('v4ThemeButton');if(b){b.textContent=light?'Tema: Terang':'Tema: Gelap';b.setAttribute('aria-pressed',String(!light));}}
  // Default to a soft-light theme for new installs; preserve an explicit saved preference.
  try {
    const pref = (typeof studyPrefs!=='undefined' && studyPrefs && studyPrefs.theme) || null;
    if(pref==='light'){root.classList.add('light-theme');root.classList.remove('dark-theme');}
    else if(pref==='dark'){root.classList.remove('light-theme');root.classList.add('dark-theme');}
    else {root.classList.add('light-theme');root.classList.remove('dark-theme');}
  } catch(e) { root.classList.add('light-theme'); }
  // Override legacy toggle so dark mode uses the V4 charcoal palette and is persisted.
  if(hiddenTheme && typeof themeSwitch==='function') hiddenTheme.removeEventListener('click',themeSwitch);
  if(hiddenTheme){hiddenTheme.textContent=root.classList.contains('light-theme')?'Tema gelap':'Tema terang';hiddenTheme.setAttribute('aria-pressed',String(root.classList.contains('dark-theme')));}
  // The navigation already has five sections; localize its visible labels without changing routing.
  const labels={home:'Beranda',learn:'Belajar',quiz:'Kuis',reading:'Reading',progress:'Progres'};
  document.querySelectorAll('[data-v3-view]').forEach(btn=>{const key=btn.getAttribute('data-v3-view');const span=btn.querySelector('span:not(.nav-ico)');if(span&&labels[key])span.textContent=labels[key];});
  // Add a simple storage note without claiming local storage is universally persistent on file://.
  const homeFoot=$('v3HomePanel')?.querySelector('.v3-home-foot');
  if(homeFoot&&!$('v4StorageNote')){const note=document.createElement('span');note.id='v4StorageNote';note.className='tiny';note.textContent='Progres disimpan di browser ini. Ekspor progres secara berkala sebagai cadangan.';homeFoot.appendChild(note);}
  syncThemeLabel();
})();
