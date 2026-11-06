import { createSeasonalThemeEngine } from './seasonal/seasonal-engine.js';

const $ = (id) => document.getElementById(id);
const SEASONAL_CONFIG_URL = './assets/config/seasonal_theme.json';
const ASSET_BASE = './assets/illustrations/';
const EMPTY_BASE = './assets/empty-states/';

const FEATURE_ROUTES = new Set(['flashcards', 'learn', 'reading', 'grammar', 'listening', 'exam', 'audit']);
const ROUTE_PRIMARY = {
  home: 'home', progress: 'progress',
  flashcards: 'learn', learn: 'learn', grammar: 'learn', listening: 'learn', exam: 'learn',
  audit: 'settings'
};

let engine = null;
let lastPrimaryPage = 'home';
let returnPage = 'home';
let pendingPrimary = null;
let librarySearchTimer = null;

function safeText(value) { return String(value ?? ''); }
function getAllWords() {
  try {
    if (typeof allWords !== 'undefined' && Array.isArray(allWords)) return allWords;
  } catch (_) { /* Legacy lexical binding may not be initialized yet. */ }
  return Array.isArray(window.allWords) ? window.allWords : [];
}
function getV13State() {
  try { return window.NihongoStudyDeckV13?.getState?.() || {}; } catch (_) { return {}; }
}
function getV13Snapshot() {
  try { return window.NihongoStudyDeckV13?.getSnapshot?.() || {}; } catch (_) { return {}; }
}
function setNavActive(page) {
  document.querySelectorAll('[data-v19-route]').forEach((button) => {
    const active = button.dataset.v19Route === page;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  document.body.dataset.v19Page = page;
}
function setFocusMode(route) {
  const focus = route === 'flashcards' || (route === 'reading' && Boolean($('v11Japanese') && !$('v11Japanese').classList.contains('hidden')));
  document.body.dataset.v19Focus = focus ? 'true' : 'false';
}
function updateLegacyRouteMarker(route) {
  if (!route) return;
  document.body.dataset.v187Route = route;
  document.body.dataset.v187Section = ({
    home: 'home', flashcards: 'flashcards', learn: 'practice', grammar: 'practice',
    listening: 'practice', exam: 'practice', reading: 'reading', progress: 'progress', audit: 'progress'
  })[route] || 'home';
}
function hideAllLegacyScreens() {
  [
    'v13TutorHome', 'v13TutorProgress', 'v10LabPanel', 'flashcardLayout', 'quizPanel',
    'readingPanel', 'v3HomePanel', 'v3ProgressPanel', 'metrics', 'dashboardPanel',
    'legacyBottomGrid', 'v187PracticeLinks'
  ].forEach((id) => $(id)?.classList.add('hidden'));
}
function hideCustomScreens() {
  ['v19LearnHub', 'v19LibraryHub', 'v19SettingsView'].forEach((id) => $(id)?.setAttribute('hidden', ''));
}
function showHub(page) {
  hideAllLegacyScreens();
  hideCustomScreens();
  const target = page === 'learn' ? $('v19LearnHub') : $('v19LibraryHub');
  target?.removeAttribute('hidden');
  lastPrimaryPage = page;
  setNavActive(page);
  setFocusMode('hub');
  updateLegacyRouteMarker(page === 'learn' ? 'learn' : 'reading');
  window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  if (page === 'library') renderLibrarySavedState();
}
function showSettings() {
  returnPage = lastPrimaryPage || 'home';
  hideAllLegacyScreens();
  hideCustomScreens();
  $('v19SettingsView')?.removeAttribute('hidden');
  setNavActive('');
  setFocusMode('settings');
  updateLegacyRouteMarker('progress');
  window.scrollTo({ top: 0, behavior: 'auto' });
}
function navigateBackFromSettings() {
  const target = returnPage === 'settings' ? 'home' : returnPage;
  if (target === 'learn' || target === 'library') showHub(target);
  else navigateFeature(target === 'progress' ? 'progress' : 'home', target);
}
function navigateFeature(route, preferredPrimary = null) {
  const api = window.NihongoStudyDeckV13;
  if (!api || typeof api.navigate !== 'function') {
    console.warn('[V19.1] Navigation API V13 belum tersedia.');
    return;
  }
  pendingPrimary = preferredPrimary || ROUTE_PRIMARY[route] || 'learn';
  hideCustomScreens();
  api.navigate(route);
  pendingPrimary = null;
  if (route !== 'audit') syncRouteFromLegacy(route);
}
function syncRouteFromLegacy(routeOverride = null) {
  const route = routeOverride || document.body.dataset.v187Route || 'home';
  const primary = pendingPrimary || ROUTE_PRIMARY[route] || lastPrimaryPage || 'home';
  if (primary === 'home' || primary === 'learn' || primary === 'library' || primary === 'progress') lastPrimaryPage = primary;
  hideCustomScreens();
  setNavActive(primary);
  setFocusMode(route);
  updateLegacyRouteMarker(route);
}
function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function localImage(filename, alt, className = '') {
  const img = document.createElement('img');
  img.src = `${EMPTY_BASE}${filename}`;
  img.alt = alt;
  img.loading = 'lazy';
  img.decoding = 'async';
  if (className) img.className = className;
  return img;
}
function createEmptyState(filename, title, description, className = 'v19-empty-state') {
  const box = createElement('div', className);
  box.append(localImage(filename, title));
  const copy = createElement('div');
  copy.append(createElement('strong', '', title), createElement('p', '', description));
  box.append(copy);
  return box;
}
function addTransitionOptIn(root = document) {
  const selector = [
    '.v19-bottom-nav button', '.v19-action-card', '.v19-library-result', '.v19-settings-view',
    '.panel', '.metric', '.v13-card', '.v13-hero', '.v10-panel-card', '.v10-question-card',
    '.v186-study-card', '.v187-data-panel', '.v13-nav-btn', 'button.primary', '.chip', '.tag'
  ].join(',');
  root.querySelectorAll?.(selector).forEach((node) => node.setAttribute('data-seasonal-transition', ''));
}

function buildNavigation() {
  const oldNav = $('v187Nav');
  if (!oldNav || $('v19BottomNav')) return;
  oldNav.remove();
  const nav = createElement('nav', 'v19-bottom-nav');
  nav.id = 'v19BottomNav';
  nav.setAttribute('aria-label', 'Navigasi utama');
  const items = [
    ['home', '⌂', 'Home'],
    ['learn', '▤', 'Learn'],
    ['library', '▥', 'Library'],
    ['progress', '↗', 'Progress']
  ];
  for (const [route, symbol, label] of items) {
    const button = createElement('button', '', '');
    button.type = 'button';
    button.dataset.v19Route = route;
    const icon = createElement('span', 'nav-symbol', symbol);
    icon.setAttribute('aria-hidden', 'true');
    button.append(icon, createElement('span', '', label));
    button.addEventListener('click', () => {
      if (route === 'learn' || route === 'library') showHub(route);
      else navigateFeature(route, route);
    });
    nav.append(button);
  }
  document.querySelector('.topbar')?.insertAdjacentElement('afterend', nav);
  addTransitionOptIn(nav);
}

function buildHubs() {
  if ($('v19LearnHub')) return;
  const nav = $('v19BottomNav');
  if (!nav) return;

  const learn = createElement('section', 'v19-hub');
  learn.id = 'v19LearnHub';
  learn.hidden = true;
  learn.innerHTML = `
    <header class="v19-hub-head"><p class="v19-eyebrow">YOUR COZY STUDY ROOM</p><h2 class="v19-hub-title">Mau belajar apa hari ini?</h2><p class="v19-hub-subtitle">Pilih aktivitas dan lanjutkan belajar dari tempat yang paling nyaman.</p></header>
    <div class="v19-study-hero" data-seasonal-transition>
      <div class="v19-study-hero-copy"><p class="v19-eyebrow">A QUIET PLACE TO LEARN</p><strong>Belajar sedikit demi sedikit, setiap hari.</strong><p>Ruang belajar yang sama, dengan suasana yang mengikuti empat musim Jepang.</p></div>
      <img id="v19StudyRoomImage" src="" alt="Interior ruang belajar rumah Jepang di pedesaan" loading="lazy" decoding="async">
    </div>
    <section class="v19-hub-section"><h3 class="v19-hub-section-title">Practice</h3><div class="v19-card-grid">
      <button class="v19-action-card" data-v19-feature="flashcards"><span class="v19-action-icon">▤</span><span class="v19-action-copy"><strong>Flashcard &amp; SRS</strong><small>Review, recall, typing, dan mode klasik.</small></span><span class="v19-action-arrow">›</span></button>
      <button class="v19-action-card" data-v19-feature="learn"><span class="v19-action-icon">✓</span><span class="v19-action-copy"><strong>Quiz kosakata</strong><small>Arti, kanji, bacaan, konteks, dan latihan campuran.</small></span><span class="v19-action-arrow">›</span></button>
      <button class="v19-action-card" data-v19-feature="adaptive"><span class="v19-action-icon">◈</span><span class="v19-action-copy"><strong>Sesi adaptif</strong><small>Review lebih dahulu, lalu fokus ke kelemahan.</small></span><span class="v19-action-arrow">›</span></button>
    </div></section>
    <section class="v19-hub-section"><h3 class="v19-hub-section-title">Skills</h3><div class="v19-card-grid">
      <button class="v19-action-card" data-v19-feature="reading"><span class="v19-action-icon">本</span><span class="v19-action-copy"><strong>Reading Practice</strong><small>Smart Reader, bacaan bertingkat, furigana, dan pemahaman.</small></span><span class="v19-action-arrow">›</span></button>
      <button class="v19-action-card" data-v19-feature="grammar"><span class="v19-action-icon">文</span><span class="v19-action-copy"><strong>Grammar Practice</strong><small>Grammar Tutor dan referensi pola N5–N1.</small></span><span class="v19-action-arrow">›</span></button>
      <button class="v19-action-card" data-v19-feature="listening"><span class="v19-action-icon">♫</span><span class="v19-action-copy"><strong>Listening &amp; Shadowing</strong><small>Audio Jepang, pronunciation, dan pengulangan.</small></span><span class="v19-action-arrow">›</span></button>
      <button class="v19-action-card" data-v19-feature="personal-tutor"><span class="v19-action-icon">✎</span><span class="v19-action-copy"><strong>Personal Tutor</strong><small>Bedah kalimat Jepang dengan kamus lokal dan petunjuk partikel.</small></span><span class="v19-action-arrow">›</span></button>
      <button class="v19-action-card" data-v19-feature="exam"><span class="v19-action-icon">試</span><span class="v19-action-copy"><strong>Simulasi JLPT</strong><small>Latihan bertimer dengan materi N5–N1 yang tersedia.</small></span><span class="v19-action-arrow">›</span></button>
    </div></section>
    <section id="v19EmptyReview" class="v19-empty-state" hidden></section>
    <p class="v19-hub-subtitle">Fitur belajar lanjutan tetap tersedia melalui halaman dan panel yang sudah ada. Tampilan ini hanya menjadi pintu masuk yang lebih ringkas.</p>`;

  const library = createElement('section', 'v19-hub');
  library.id = 'v19LibraryHub';
  library.hidden = true;
  library.innerHTML = `
    <header class="v19-hub-head"><p class="v19-eyebrow">YOUR JAPANESE LIBRARY</p><h2 class="v19-hub-title">Perpustakaan</h2><p class="v19-hub-subtitle">Cari kosakata, jelajahi kanji melalui entri kosakata, buka pola grammar, atau lanjutkan bacaan.</p></header>
    <form class="v19-library-search" id="v19LibrarySearchForm"><input id="v19LibrarySearchInput" type="search" placeholder="Cari kanji, kosakata, bacaan…" autocomplete="off" aria-label="Cari koleksi bahasa Jepang"><button type="submit">Cari</button></form>
    <div id="v19LibraryResults" class="v19-library-results" aria-live="polite"><p class="tiny">Masukkan kata Jepang, kana, kanji, atau arti bahasa Indonesia untuk mencari di dataset kosakata lokal.</p></div>
    <div class="v19-hub-section"><h3 class="v19-hub-section-title">Jelajahi materi</h3><div class="v19-card-grid">
      <button class="v19-action-card" data-v19-feature="vocabulary"><span class="v19-action-icon">語</span><span class="v19-action-copy"><strong>Vocabulary</strong><small>Cari kata, bacaan, arti, dan contoh.</small></span><span class="v19-action-arrow">›</span></button>
      <button class="v19-action-card" data-v19-feature="kanji"><span class="v19-action-icon">漢</span><span class="v19-action-copy"><strong>Kanji melalui kosakata</strong><small>Temukan karakter lewat entri vocabulary yang tersedia.</small></span><span class="v19-action-arrow">›</span></button>
      <button class="v19-action-card" data-v19-feature="grammar-library"><span class="v19-action-icon">文</span><span class="v19-action-copy"><strong>Grammar Reference</strong><small>Daftar pola grammar dan latihan yang tersedia.</small></span><span class="v19-action-arrow">›</span></button>
      <button class="v19-action-card" data-v19-feature="reading-library"><span class="v19-action-icon">本</span><span class="v19-action-copy"><strong>Reading Library</strong><small>Bacaan N5–N1, filter, favorit, dan progres.</small></span><span class="v19-action-arrow">›</span></button>
    </div></div>
    <div class="v19-hub-section"><h3 class="v19-hub-section-title">Disimpan</h3><div id="v19SavedCollection"></div></div>
    <p class="tiny">Catatan: indeks kanji V19.0 merupakan indeks karakter yang diekstrak dari kosakata dan masih memerlukan tinjauan; halaman ini tidak menyajikannya sebagai kamus kanji lengkap terverifikasi.</p>`;

  const settings = createElement('section', 'v19-settings-view');
  settings.id = 'v19SettingsView';
  settings.hidden = true;
  settings.innerHTML = `
    <header class="v19-settings-header"><button type="button" id="v19SettingsBack" aria-label="Kembali">‹</button><div><p class="v19-eyebrow">PREFERENCES &amp; MAINTENANCE</p><h2>Pengaturan</h2></div></header>
    <section class="v19-settings-section"><h3>Tampilan aplikasi</h3><p>Musim berubah otomatis mengikuti kalender Jepang. Pilihan terang/gelap tetap mengikuti preferensi lu.</p><div id="v19AppearanceControls"></div></section>
    <section class="v19-settings-section"><h3>Preferensi belajar</h3><div id="v19LearningPreferences"></div></section>
    <section class="v19-settings-section"><h3>Audio Jepang</h3><p>Pengaturan voice dan kecepatan tersedia sesuai dukungan browser/perangkat.</p><div id="v19AudioPreferences"></div></section>
    <section class="v19-settings-section"><h3>Reading</h3><p>Pengaturan furigana dan ukuran teks tetap tersedia pada toolbar Reader ketika membuka bacaan.</p><button type="button" id="v19OpenReaderPrefs">Buka Reading Library</button></section>
    <section class="v19-settings-section"><h3>Data &amp; pemeliharaan</h3><p>Backup, restore, import, export, audit, dan editor dipertahankan di sini.</p><button type="button" id="v19OpenAudit">Buka audit konten</button><div id="v19MaintenanceHost"></div></section>
    <p class="tiny">Pengaturan ini tidak mengubah jadwal SRS atau konten belajar kecuali lu menjalankan tindakan yang memang dimaksudkan untuk itu.</p>`;

  nav.insertAdjacentElement('afterend', learn);
  learn.insertAdjacentElement('afterend', library);
  library.insertAdjacentElement('afterend', settings);
  addTransitionOptIn(document);
}

function setupBrandHeader() {
  const brand = document.querySelector('.topbar .brand');
  if (brand && !brand.dataset.v19Branded) {
    brand.dataset.v19Branded = 'true';
    brand.replaceChildren();
    const icon = document.createElement('img');
    icon.className = 'v19-brand-icon';
    icon.src = './assets/branding/android/app_icon_192.png';
    icon.alt = '';
    icon.width = 46;
    icon.height = 46;
    const copy = createElement('div', 'v19-brand-copy');
    copy.append(createElement('h1', '', 'Nihongo Study Deck'), createElement('p', '', 'Belajar dengan tenang · offline'));
    brand.append(icon, copy);
  }
  const topbar = document.querySelector('.topbar');
  if (topbar && !$('v19SettingsTrigger')) {
    const tools = createElement('div', 'v19-header-tools');
    tools.id = 'v19HeaderTools';
    const gear = createElement('button', 'v19-settings-trigger', '⚙');
    gear.type = 'button'; gear.id = 'v19SettingsTrigger'; gear.title = 'Pengaturan'; gear.setAttribute('aria-label', 'Buka Pengaturan');
    gear.addEventListener('click', showSettings);
    tools.append(gear);
    topbar.append(tools);
  }
  document.title = 'Nihongo Study Deck V19.1 — Cozy Japanese Countryside';
  const appName = document.querySelector('meta[name="application-name"]');
  if (appName) appName.content = 'Nihongo Study Deck V19.1';
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = 'Belajar bahasa Jepang dengan suasana Cozy Japanese Countryside, empat musim, flashcard, SRS, reading, grammar, listening, dan progres lokal.';
}

function arrangeSettingsAndMaintenance() {
  const settings = $('v19SettingsView');
  if (!settings || settings.dataset.arranged === 'true') return;
  const move = (element, target) => { if (element && target) target.append(element); };
  move($('v187Utility'), $('v19AppearanceControls'));
  const homePrefs = $('v13TutorHome')?.querySelector('.v13-grid2 .v13-card .v13-settings');
  move(homePrefs, $('v19LearningPreferences'));
  const audioPrefs = $('v13AudioWorkstation')?.querySelector(':scope > .v13-settings');
  move(audioPrefs, $('v19AudioPreferences'));
  move($('v187DataPanel'), $('v19MaintenanceHost'));
  settings.dataset.arranged = 'true';
}

function insertHomeSeasonHero() {
  const home = $('v13TutorHome');
  if (!home || $('v19HomeSeasonHero')) return;
  const hero = createElement('section', 'v19-season-hero');
  hero.id = 'v19HomeSeasonHero';
  hero.setAttribute('data-seasonal-transition', '');
  const image = document.createElement('img');
  image.id = 'v19HomeSeasonImage';
  image.alt = 'Rumah tradisional Jepang di pedesaan pada musim yang sedang berlangsung';
  image.width = 1080; image.height = 1350;
  image.loading = 'eager'; image.decoding = 'async';
  image.fetchPriority = 'high';
  const caption = createElement('div', 'v19-season-caption');
  caption.id = 'v19HomeSeasonCaption';
  caption.innerHTML = '<span class="season-kana">四季</span><strong>Cozy Japanese Countryside</strong><small>A little place to grow every day.</small>';
  hero.append(image, caption);
  home.insertBefore(hero, home.firstChild);
  const dueButton = $('v13DueAction');
  if (dueButton && !$('v19EmptyReview')) {
    const empty = createEmptyState('empty_review.png', 'Tidak ada review yang menunggu', 'Semua kartu yang jatuh tempo sudah ditangani. Materi baru akan muncul sesuai jadwal belajarmu.');
    empty.id = 'v19EmptyReview';
    dueButton.insertAdjacentElement('afterend', empty);
  }
}

function configureSettingsActions() {
  $('v19SettingsBack')?.addEventListener('click', navigateBackFromSettings);
  $('v19OpenAudit')?.addEventListener('click', () => navigateFeature('audit', 'settings'));
  $('v19OpenReaderPrefs')?.addEventListener('click', () => navigateFeature('reading', 'library'));
  const oldUtility = $('v187Utility');
  if (oldUtility) oldUtility.classList.add('v19-settings-utility');
}

function handleFeatureClick(feature) {
  if (feature === 'personal-tutor') {
    navigateFeature('reading', 'learn');
    setTimeout(() => $('v13SentenceInput')?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }), 180);
    return;
  }
  if (feature === 'vocabulary' || feature === 'kanji') {
    const input = $('v19LibrarySearchInput');
    if (input) {
      input.placeholder = feature === 'kanji'
        ? 'Cari karakter kanji dalam entri kosakata…'
        : 'Cari kosakata, kana, kanji, atau arti…';
      input.focus({ preventScroll: true });
    }
    return;
  }
  if (feature === 'adaptive') {
    navigateFeature('listening', 'learn');
    setTimeout(() => window.NihongoStudyDeckV10?.switchTab?.('adaptive'), 0);
    return;
  }
  const map = {
    flashcards: ['flashcards', 'learn'],
    learn: ['learn', 'learn'],
    grammar: ['grammar', 'learn'],
    reading: ['reading', 'learn'],
    listening: ['listening', 'learn'],
    exam: ['exam', 'learn'],
    'grammar-library': ['grammar', 'library'],
    'reading-library': ['reading', 'library']
  };
  const [route, primary] = map[feature] || ['home', 'home'];
  navigateFeature(route, primary);
}

function setupHubActions() {
  document.querySelectorAll('[data-v19-feature]').forEach((button) => {
    button.addEventListener('click', () => handleFeatureClick(button.dataset.v19Feature));
  });
  $('v19LibrarySearchForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    renderLibrarySearchResults();
  });
  $('v19LibrarySearchInput')?.addEventListener('input', () => {
    clearTimeout(librarySearchTimer);
    librarySearchTimer = setTimeout(renderLibrarySearchResults, 120);
  });
}

function renderLibrarySearchResults() {
  const host = $('v19LibraryResults');
  const field = $('v19LibrarySearchInput');
  if (!host || !field) return;
  const query = field.value.trim().toLocaleLowerCase('id-ID');
  host.replaceChildren();
  if (!query) {
    host.append(createElement('p', 'tiny', 'Masukkan kata Jepang, kana, kanji, atau arti bahasa Indonesia untuk mulai mencari.'));
    return;
  }
  const matches = getAllWords().filter((word) => {
    const haystack = [word.japanese, word.hiragana, word.meaning, word.partOfSpeech, word.jlpt].map(safeText).join(' ').toLocaleLowerCase('id-ID');
    return haystack.includes(query);
  }).slice(0, 8);
  if (!matches.length) {
    host.append(createEmptyState('empty_search.png', 'Tidak ada hasil yang cocok', 'Coba kata lain, kanji yang lebih pendek, atau arti dalam bahasa Indonesia.', 'v19-library-empty'));
    return;
  }
  for (const word of matches) {
    const button = createElement('button', 'v19-library-result');
    button.type = 'button';
    const copy = createElement('span');
    const title = createElement('strong', '', safeText(word.japanese || '—'));
    const detail = createElement('small', '', `${safeText(word.hiragana || 'Bacaan belum tersedia')} · ${safeText(word.meaning || 'Arti belum tersedia')}`);
    copy.append(title, detail);
    const level = createElement('small', '', safeText(word.jlpt || 'Vocabulary'));
    button.append(copy, level);
    button.addEventListener('click', () => renderLibraryWordDetail(word));
    host.append(button);
  }
  if (matches.length === 8) host.append(createElement('p', 'tiny', 'Menampilkan maksimal 8 hasil teratas. Persempit kata pencarian untuk hasil yang lebih spesifik.'));
}

function renderLibraryWordDetail(word) {
  const host = $('v19LibraryResults');
  if (!host || !word) return;
  host.replaceChildren();
  const detail = createElement('article', 'v19-library-detail');
  detail.append(
    createElement('p', 'v19-eyebrow', safeText(word.jlpt || 'VOCABULARY')),
    createElement('h3', 'v19-library-detail-word', safeText(word.japanese || '—')),
    createElement('p', 'v19-library-detail-reading', safeText(word.hiragana || 'Bacaan belum tersedia')),
    createElement('p', 'v19-library-detail-meaning', safeText(word.meaning || 'Arti belum tersedia'))
  );
  if (word.exampleJapanese || word.exampleMeaning) {
    const example = createElement('div', 'v19-library-detail-example');
    if (word.exampleJapanese) example.append(createElement('strong', '', safeText(word.exampleJapanese)));
    if (word.exampleMeaning) example.append(createElement('p', '', safeText(word.exampleMeaning)));
    detail.append(example);
  }
  const actions = createElement('div', 'v19-library-detail-actions');
  const back = createElement('button', 'soft', 'Kembali ke hasil');
  back.type = 'button';
  back.addEventListener('click', renderLibrarySearchResults);
  const save = createElement('button', 'primary', 'Simpan ke koleksi');
  save.type = 'button';
  const isSaved = () => {
    const state = getV13State();
    return [...(state.savedVocabulary || []), ...(state.capturedWords || [])].some(item => String(item.id ?? '') === String(word.id ?? '') || item.japanese === word.japanese);
  };
  if (isSaved()) { save.textContent = 'Sudah tersimpan'; save.disabled = true; }
  save.addEventListener('click', () => {
    const result = window.NihongoStudyDeckV13?.saveVocabulary?.(word.id);
    if (result) {
      save.textContent = 'Tersimpan'; save.disabled = true;
      renderLibrarySavedState();
    } else {
      save.textContent = 'Gagal menyimpan';
    }
  });
  const study = createElement('button', 'soft', 'Latih di Flashcard');
  study.type = 'button';
  study.addEventListener('click', () => {
    navigateFeature('flashcards', 'learn');
    setTimeout(() => {
      const classic = $('v187UseClassic');
      if (classic && !document.body.classList.contains('v187-classic-flashcards')) classic.click();
      const search = $('search');
      if (search) { search.value = safeText(word.japanese); search.dispatchEvent(new Event('input', { bubbles: true })); }
    }, 140);
  });
  actions.append(back, save, study);
  detail.append(actions);
  host.append(detail);
}

function renderLibrarySavedState() {
  const host = $('v19SavedCollection');
  if (!host) return;
  host.replaceChildren();
  const state = getV13State();
  const saved = [...(Array.isArray(state.savedVocabulary) ? state.savedVocabulary : []), ...(Array.isArray(state.capturedWords) ? state.capturedWords : [])];
  if (!saved.length) {
    host.append(createEmptyState('empty_library.png', 'Koleksi tersimpan masih kosong', 'Simpan kosakata dari Reader untuk membangun perpustakaan pribadimu.', 'v19-library-empty'));
    return;
  }
  saved.forEach((item) => {
    const row = createElement('div', 'v19-library-result');
    const text = createElement('span');
    text.append(createElement('strong', '', safeText(item.japanese || '—')), createElement('small', '', `${safeText(item.hiragana || '—')} · ${safeText(item.meaning || 'Arti belum tersedia')}`));
    row.append(text);
    host.append(row);
  });
}

function refreshEmptyStates() {
  const snapshot = getV13Snapshot();
  const due = Number(snapshot.due || 0);
  const review = $('v19EmptyReview');
  if (review) review.hidden = due > 0;
  if (review) review.classList.toggle('hidden', due > 0);

  const state = getV13State();
  const historyRows = Array.isArray(snapshot.quiz?.rows) ? snapshot.quiz.rows : [];
  const sessionLog = Array.isArray(state.sessionLog) ? state.sessionLog : [];
  const listeningAttempts = Number(state.listeningStats?.attempts || 0);
  const grammarAttempts = Number(state.grammarStats?.attempts || 0);
  const readingCompleted = Number(snapshot.reading?.completed || 0);
  const hasProgress = historyRows.length || sessionLog.length || readingCompleted || listeningAttempts || grammarAttempts || Number(snapshot.mastered || 0) || Number(snapshot.due || 0) || Number(snapshot.mistakes || 0);

  const progress = $('v13TutorProgress');
  if (progress && !$('v19EmptyProgress')) {
    const panel = createEmptyState('empty_progress.png', 'Jurnal belajarmu akan tumbuh di sini', 'Selesaikan sesi pertama untuk mulai mengisi ringkasan perkembangan.', 'v19-empty-state');
    panel.id = 'v19EmptyProgress';
    progress.insertBefore(panel, progress.firstChild);
  }
  if ($('v19EmptyProgress')) $('v19EmptyProgress').hidden = Boolean(hasProgress);

  const recent = $('v13RecentResults');
  if (recent) {
    let historyEmpty = $('v19EmptyHistory');
    if (!historyRows.length && !sessionLog.length && !readingCompleted) {
      if (!historyEmpty) {
        historyEmpty = createEmptyState('empty_history.png', 'Riwayat belajar belum tercatat', 'Hasil kuis dan aktivitas akan muncul setelah lu menyelesaikan sesi pertama.', 'v19-empty-state');
        historyEmpty.id = 'v19EmptyHistory';
        recent.prepend(historyEmpty);
      }
    } else if (historyEmpty) historyEmpty.remove();
  }
}

function updateThemeMetadata(theme) {
  if (!theme) return;
  const meta = document.querySelector('meta[name="theme-color"]');
  const token = theme.tokens?.background || theme.tokens?.primary || '#F5F0E4';
  if (meta) meta.content = token;
  const homeLabel = $('v19HomeSeasonCaption');
  if (homeLabel && theme.metadata) {
    const season = theme.metadata;
    homeLabel.replaceChildren();
    homeLabel.append(
      createElement('span', 'season-kana', `${safeText(season.japanese || '')} · ${safeText(season.romaji || '')}`),
      createElement('strong', '', 'Cozy Japanese Countryside'),
      createElement('small', '', 'A little place to grow every day.')
    );
  }
}
function applySeasonAssets(theme) {
  if (!theme?.metadata?.assets) return;
  const home = $('v19HomeSeasonImage');
  const study = $('v19StudyRoomImage');
  const homePath = theme.metadata.assets.home;
  const studyPath = theme.metadata.assets.studyRoom;
  if (home && homePath) {
    const next = `${ASSET_BASE}${homePath}`;
    if (home.getAttribute('src') !== next) home.src = next;
  }
  if (study && studyPath) {
    const next = `${ASSET_BASE}${studyPath}`;
    if (study.getAttribute('src') !== next) study.src = next;
  }
  updateThemeMetadata(theme);
}

function hookNavigation() {
  const api = window.NihongoStudyDeckV13;
  if (api && typeof api.navigate === 'function' && !api.__v19CozyWrapped) {
    const original = api.navigate.bind(api);
    api.navigate = function(route) {
      const result = original(route);
      const primary = pendingPrimary || ROUTE_PRIMARY[route] || lastPrimaryPage || 'home';
      if (primary === 'home' || primary === 'learn' || primary === 'library' || primary === 'progress') lastPrimaryPage = primary;
      hideCustomScreens();
      setNavActive(primary);
      setFocusMode(route);
      updateLegacyRouteMarker(route);
      setTimeout(refreshEmptyStates, 80);
      return result;
    };
    api.__v19CozyWrapped = true;
  }
  document.addEventListener('click', (event) => {
    if (event.target.closest('#v19BottomNav')) return;
    setTimeout(() => {
      const route = document.body.dataset.v187Route;
      if (route && route !== 'learn-hub' && route !== 'library-hub') {
        const primary = ROUTE_PRIMARY[route];
        if (primary) {
          lastPrimaryPage = primary;
          hideCustomScreens();
          setNavActive(primary);
          setFocusMode(route);
        }
      }
      refreshEmptyStates();
    }, 60);
  }, true);
  window.addEventListener('nihongo:seasonal-theme-change', () => setTimeout(refreshEmptyStates, 50));
}

function injectSeasonStatusFallback(message) {
  const host = $('v19SettingsView');
  if (!host || $('v19SeasonalEngineWarning')) return;
  const note = createElement('p', 'v19-settings-section', message);
  note.id = 'v19SeasonalEngineWarning';
  host.append(note);
}

async function startSeasonalEngine() {
  try {
    const response = await fetch(SEASONAL_CONFIG_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Theme configuration returned HTTP ${response.status}.`);
    const config = await response.json();
    engine = createSeasonalThemeEngine({
      config,
      rootElement: document.documentElement,
      onError: (error) => console.error('[Nihongo Seasonal Engine]', error)
    });
    engine.subscribe((event) => {
      const theme = engine.getCurrentTheme();
      applySeasonAssets(theme);
      document.documentElement.dataset.seasonChangedAt = event.timestamp;
      refreshEmptyStates();
    });
    engine.start();
    window.NihongoSeasonalEngine = engine;
    applySeasonAssets(engine.getCurrentTheme());
    document.documentElement.dataset.seasonalEngineStatus = 'ready';
  } catch (error) {
    console.error('[V19.1] Seasonal Engine gagal dimulai; fitur belajar tetap berjalan.', error);
    document.documentElement.dataset.seasonalEngineStatus = 'fallback';
    injectSeasonStatusFallback(`Seasonal Engine belum aktif: ${error.message}. Preferensi tema lama dan seluruh fitur belajar tetap dapat digunakan.`);
  }
}

function installWhenReady(attempt = 0) {
  if (document.body?.dataset.v19CozyInstalled === 'true') return;
  const ready = window.NihongoStudyDeckV13 && document.body?.dataset.v187Installed === 'true' && $('v187Nav') && $('v13TutorHome') && $('v13TutorProgress');
  if (!ready) {
    if (attempt < 120) setTimeout(() => installWhenReady(attempt + 1), 50);
    else console.error('[V19.1] UI integration install timed out; legacy app remains available.');
    return;
  }
  document.body.dataset.v19CozyInstalled = 'true';
  setupBrandHeader();
  buildNavigation();
  buildHubs();
  arrangeSettingsAndMaintenance();
  insertHomeSeasonHero();
  configureSettingsActions();
  setupHubActions();
  hookNavigation();
  addTransitionOptIn(document);
  if ($('v187PracticeLinks')) $('v187PracticeLinks').remove();
  // Home remains the original V19.0 home screen with the new seasonal hero.
  hideCustomScreens();
  hideAllLegacyScreens();
  window.NihongoStudyDeckV13.navigate('home');
  setNavActive('home');
  setFocusMode('home');
  refreshEmptyStates();
  if (engine) applySeasonAssets(engine.getCurrentTheme());
  setTimeout(refreshEmptyStates, 400);
}

// Start seasonal detection as soon as this module loads so the first rendered V19.1 UI
// can use the correct Tokyo-season palette. Legacy screen integration remains separately gated.
startSeasonalEngine();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => installWhenReady(), { once: true });
} else {
  installWhenReady();
}
setTimeout(() => installWhenReady(), 40);
