
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n};
 const routeSection=route=>({home:'home',flashcards:'flashcards',learn:'practice',grammar:'practice',exam:'practice',listening:'practice',reading:'reading',progress:'progress',audit:'progress'}[route]||'home');
 let activeRoute='home';
 function setRoute(route){
   activeRoute=route||activeRoute;
   const section=routeSection(activeRoute);
   document.body.dataset.v187Route=activeRoute;
   document.body.dataset.v187Section=section;
   document.querySelectorAll('[data-v187-route]').forEach(b=>{
     const active=b.dataset.v187Route===section;
     b.classList.toggle('active',active);
     if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
   });
   if(activeRoute!=='flashcards')document.body.classList.remove('v187-classic-flashcards');
   updateMiniCount();
 }
 function navigate(route){
   const api=window.NihongoStudyDeckV13;
   if(api&&typeof api.navigate==='function')api.navigate(route);
   setRoute(route);
 }
 function sectionGroup(title,description){const s=node('section','v187-tool-group');s.append(node('h4','',title));if(description)s.append(node('p','v187-muted',description));return s;}
 function putControlsInGroups(){
   const panel=$('v186AdvancedPanel'),setup=$('v186Setup');if(!panel||!setup||setup.dataset.v187Grouped==='true')return;
   const fieldFor=id=>[...setup.children].find(ch=>ch.querySelector&&ch.querySelector('#'+id));
   const scope=fieldFor('v186Scope'),direction=fieldFor('v186Direction'),response=fieldFor('v186Response');
   const type=fieldFor('v186CardType'),target=fieldFor('v186Target'),level=fieldFor('v186Level'),status=fieldFor('v186CardStatus'),srs=fieldFor('v186SrsMode'),limit=fieldFor('v186Limit');
   const romaji=setup.querySelector('#v186AllowRomaji')?.closest('.checkrow');
   const actions=setup.querySelector(':scope > .v186-actions');
   const start=$('v186Start'),audit=$('v186AuditBtn'),expAudit=$('v186ExportAuditBtn'),expCsv=$('v186ExportCsvBtn');
   const main=node('div','v187-main-settings');
   if(scope){scope.classList.add('v187-wide');main.append(scope)}
   const row=node('div','v187-settings-row');if(direction)row.append(direction);if(response)row.append(response);main.append(row);
   if(start){start.classList.add('v187-start-button','primary');start.textContent='Mulai sesi';main.append(start)}
   const count=node('p','v187-availability');count.id='v187AvailableCount';count.textContent='Memuat jumlah kartu…';main.append(count);
   const advanced=document.createElement('details');advanced.className='v187-advanced';advanced.id='v187AdvancedSettings';
   const summary=node('summary','', 'Pengaturan lanjutan');advanced.append(summary);
   const materials=sectionGroup('Materi','Filter opsional untuk mempersempit sesi. Nilai tersimpan tetap dipertahankan.');
   [type,level,status].forEach(x=>x&&materials.append(x));
   const method=sectionGroup('Metode belajar','Pengaturan SRS dan cara memeriksa jawaban.');
   [target,srs,limit,romaji].forEach(x=>x&&method.append(x));
   const legacy=node('div','v187-classic-option');legacy.append(node('div','v187-classic-title','Filter dan fitur kartu klasik'),node('p','v187-muted','Pencarian, tema, favorit, urutan kartu, fokus keterampilan, romaji, ukuran teks, sesi lama, dan kontrol SRS klasik tetap tersedia dalam mode alternatif.'),(()=>{const b=node('button','', 'Buka mode kartu klasik');b.type='button';b.id='v187UseClassic';return b})());
   advanced.append(materials,method,legacy);
   setup.replaceChildren(main,advanced);
   setup.dataset.v187Grouped='true';
   if(actions){actions.remove();}
   const details=panel.querySelector('.v186-details');
   if(details){details.querySelector('summary').textContent='Audit kualitas dataset, editor entri, dan opsi impor';const actionBox=node('div','v187-audit-actions');[audit,expAudit,expCsv].forEach(b=>b&&actionBox.append(b));if(actionBox.children.length)details.insertBefore(actionBox,details.querySelector('#v186AuditMetrics'));}
   const classicReturn=node('div','v187-classic-return');const returnBtn=node('button','primary','← Kembali ke Flashcard ringkas');returnBtn.type='button';returnBtn.id='v187ReturnClassic';classicReturn.append(returnBtn);const aside=document.querySelector('#flashcardLayout .sidebar');if(aside)aside.insertBefore(classicReturn,aside.firstChild);
 }
 function updateMiniCount(){
   const out=$('v187AvailableCount');if(!out)return;
   let total='—';try{total=window.NihongoStudyDeckV186?.allCards?.().length??'—'}catch(_){}
   const due=$('v13Due')?.textContent?.trim();
   out.textContent=`${total} kartu tersedia${due&&due!=='—'?` · ${due} jatuh tempo`:''}`;
 }
 function moveDataControls(){
   const progress=$('v13TutorProgress');if(!progress||$('v187DataPanel'))return;
   const card=node('section','v187-data-panel');card.id='v187DataPanel';
   const head=node('div','v187-data-head');head.append(node('h2','', 'Data, progres, dan pemeliharaan'),node('p','v187-muted','Impor, ekspor, backup, pemulihan, audit, dan editor berada di sini. Pengelolaan data tidak mengubah jadwal SRS kecuali tindakan tersebut secara eksplisit memulihkan backup.'));card.append(head);
   const datasets=sectionGroup('Dataset','Ekspor untuk menyimpan salinan materi, atau impor file JSON untuk menambah atau memperbarui entri.');
   const backup=sectionGroup('Backup progres','Cadangkan atau pulihkan jadwal SRS, hasil belajar, dan preferensi yang didukung aplikasi.');
   const modular=sectionGroup('Backup modul tambahan','Backup ini mempertahankan format khusus Reading Intelligence dan Learning Lab.');
   const actions1=node('div','v187-tool-actions'),actions2=node('div','v187-tool-actions'),actions3=node('div','v187-tool-actions');
   const move=(id,dst)=>{const el=$(id);if(el)dst.append(el);return el};
   move('exportDatasetBtn',actions1);move('importBtn',actions1);move('importFile',actions1);move('importStatus',datasets);
   move('exportProgressBtn',actions2);move('restoreProgressBtn',actions2);move('restoreProgressFile',actions2);
   move('v13ExportBackup',actions3);move('v10ExportFullBackup',actions3);move('v10RestoreFullBackup',actions3);move('v10RestoreFile',actions3);
   if(actions1.children.length)datasets.append(actions1);if(actions2.children.length)backup.append(actions2);if(actions3.children.length)modular.append(actions3);
   const readerDetails=$('v11Export')?.closest('details');if(readerDetails){readerDetails.classList.add('v187-reader-backup');readerDetails.style.marginTop='0';modular.append(readerDetails)}
   const errorStats=$('v186ErrorMetrics');if(errorStats){const stats=sectionGroup('Review Kesalahan dan Katakana','Kesalahan aktif dipisahkan dari riwayat historis; kartu yang pulih tidak masuk antrean kesalahan aktif.');stats.append(errorStats);card.append(stats)}
   const v186Details=$('v186AdvancedPanel')?.querySelector('.v186-details');if(v186Details){v186Details.open=false;card.append(v186Details)}
   const notice=node('p','v187-muted','Penyimpanan lokal tetap menggunakan key dan skema V18.6. Perubahan navigasi ini tidak menjalankan migrasi data.');card.append(notice);
   [datasets,backup,modular].forEach(x=>{if(x.children.length)card.append(x)});
   progress.append(card);
   document.querySelector('.header-actions')?.remove();
 }
 function createNavigation(){
   if($('v187Nav'))return;
   const topbar=document.querySelector('.topbar');if(!topbar)return;
   const utility=node('div','v187-utility');utility.id='v187Utility';
   const theme=$('v4ThemeButton')||$('themeToggle');if(theme){theme.setAttribute('aria-label','Ganti tema terang atau gelap');theme.title='Ganti tema terang atau gelap';utility.append(theme)}
   const pause=$('audioPauseBtn'),stop=$('audioStopBtn');if(pause)utility.append(pause);if(stop)utility.append(stop);
   topbar.append(utility);
   const nav=node('nav','v187-nav');nav.id='v187Nav';nav.setAttribute('aria-label','Navigasi utama');
   const defs=[['home','⌂','Beranda'],['flashcards','▤','Flashcard'],['practice','✓','Latihan'],['reading','文','Reading'],['progress','↗','Progres']];
   defs.forEach(([route,ico,label])=>{const b=node('button','v187-nav-btn');b.type='button';b.dataset.v187Route=route;b.innerHTML=`<span class="v187-nav-ico" aria-hidden="true">${ico}</span><span>${label}</span>`;b.addEventListener('click',()=>navigate(({home:'home',flashcards:'flashcards',practice:'learn',reading:'reading',progress:'progress'})[route]));nav.append(b)});
   topbar.insertAdjacentElement('afterend',nav);
   // Remove legacy utility shell once its live theme/audio controls have been moved.
   document.querySelector('.v4-header-actions')?.remove();
   // Old navigations are removed after their legacy routes have already been initialized.
   $('v3Nav')?.remove();$('v13Nav')?.remove();$('modebar')?.classList.add('hidden');
 }
 function createPracticeShortcuts(){
   if($('v187PracticeLinks'))return;
   const p=node('section','v187-practice-switch');p.id='v187PracticeLinks';
   p.append(node('h2','', 'Pilih jenis latihan'),node('p','v187-muted','Kuis kosakata ditampilkan langsung. Modul lain dibuka saat dipilih.'));
   const buttons=node('div','v187-practice-buttons');
   const defs=[['quiz','Kuis kosakata'],['grammar','Grammar'],['listening','Listening & ucapan'],['exam','Simulasi JLPT'],['adaptive','Sesi adaptif']];
   defs.forEach(([route,label])=>{const b=node('button','',label);b.type='button';b.addEventListener('click',()=>{if(route==='adaptive'){navigate('listening');setTimeout(()=>window.NihongoStudyDeckV10?.switchTab?.('adaptive'),0)}else navigate(route==='quiz'?'learn':route)});buttons.append(b)});
   p.append(buttons);
   const layout=$('flashcardLayout');layout?.insertAdjacentElement('beforebegin',p);
 }
 function simplifyHome(){
   const home=$('v13TutorHome');if(!home||home.dataset.v187Simplified==='true')return;
   const quick=home.querySelector('.v13-grid2 .v13-card:nth-child(2)');
   if(quick){const details=node('details','v187-home-details');details.append(node('summary','', 'Akses semua modul'),quick);const grid=home.querySelector('.v13-grid2');grid?.insertAdjacentElement('afterend',details)}
   const action=$('v13DueAction');if(action&&!$('v187HomeReviewErrors')){const b=node('button','', 'Review Kesalahan');b.type='button';b.id='v187HomeReviewErrors';action.insertAdjacentElement('afterend',b);b.addEventListener('click',()=>{navigate('flashcards');window.NihongoStudyDeckV186?.startReviewErrors?.()})}
   const recent=home.querySelector('.v13-skill-head + .tiny');if(recent)recent.textContent='Aktivitas dicatat secara lokal. Durasi belajar aktif tidak diukur otomatis.'
   home.dataset.v187Simplified='true';
 }
 function addDataShortcuts(){
   const panel=$('v187DataPanel');if(!panel)return;
   const v13Audit=$('v13ContentAudit');if(v13Audit){v13Audit.textContent='Buka audit konten';v13Audit.title='Membuka audit otomatis di modul Learning Lab';}
 }
 function setupClassicMode(){
   $('v187UseClassic')?.addEventListener('click',()=>{document.body.classList.add('v187-classic-flashcards');const aside=document.querySelector('#flashcardLayout .sidebar');aside?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
   $('v187ReturnClassic')?.addEventListener('click',()=>{document.body.classList.remove('v187-classic-flashcards');document.querySelector('#v186AdvancedPanel')?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
 }
 function install(){
   if(document.body.dataset.v187Installed==='true')return;
   if(!window.NihongoStudyDeckV13||!$('v186AdvancedPanel')||!$('v13TutorHome')||!$('v13TutorProgress'))return;
   document.body.dataset.v187Installed='true';
   document.title='Nihongo Study Deck V19.0 — Foundation Build';
   const meta=document.querySelector('meta[name="application-name"]');if(meta)meta.content='Nihongo Study Deck V19.0 — Foundation Build';
   const desc=document.querySelector('meta[name="description"]');if(desc)desc.content='Nihongo Study Deck V18.7 — pembelajaran bahasa Jepang offline dengan navigasi ringkas, flashcard, SRS, latihan, dan Reading.';
   putControlsInGroups();moveDataControls();createNavigation();createPracticeShortcuts();simplifyHome();addDataShortcuts();setupClassicMode();
   const versionBadge=document.querySelector('.v5-version');if(versionBadge){versionBadge.textContent='V19.0';versionBadge.setAttribute('aria-label','Versi 19.0')}
   const footer=document.querySelector('.footer-note');if(footer)footer.textContent='Nihongo Study Deck V19.0 Foundation Build · Source modular dengan data lokal, Reader terhubung ke daftar review, dan SRS kompatibel. Progres tersimpan lokal; ekspor backup secara berkala.';
   // Keep route state in sync for existing in-app shortcuts and controls.
   const api=window.NihongoStudyDeckV13;
   if(api&&typeof api.navigate==='function'&&!api.__v187Wrapped){const original=api.navigate.bind(api);api.navigate=function(route){const value=original(route);setRoute(route);return value};api.__v187Wrapped=true;}
   document.addEventListener('click',e=>{
     const known=e.target.closest('#v13DueAction,#v13ProgressToStudy,#v13StartRecommended,#v13StartExam,#v13ContentAudit');
     if(known){const routes={'v13DueAction':'flashcards','v13ProgressToStudy':'flashcards','v13StartRecommended':'flashcards','v13StartExam':'exam','v13ContentAudit':'audit'};setTimeout(()=>setRoute(routes[known.id]),0);return;}
     const link=e.target.closest('[data-v13-go],[data-v13-action],[data-v13-route]');if(!link)return;
     let route=link.dataset.v13Go||link.dataset.v13Route||link.dataset.v13Action;
     if(route==='review')route='flashcards';if(route==='reading')route='reading';if(route==='progress')route='progress';if(route==='audit')route='audit';
     setTimeout(()=>setRoute(route),0);
   },true);
   document.addEventListener('click',e=>{if(e.target.closest('#v187Nav')){try{window.speechSynthesis?.cancel()}catch(_){}}});
   setRoute('home');updateMiniCount();
   // Keep the compact count fresh after review actions and UI navigation without touching storage.
   document.addEventListener('click',()=>setTimeout(updateMiniCount,80),{passive:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
 // Fallback for devices where the V13 and V18.6 initializers settle in separate DOM-ready callbacks.
 let tries=0;const retry=()=>{if(document.body.dataset.v187Installed==='true'||tries++>80)return;install();if(document.body.dataset.v187Installed!=='true')setTimeout(retry,50)};setTimeout(retry,30);
})();

