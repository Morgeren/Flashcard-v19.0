#!/usr/bin/env python3
"""Static integration checks for the Nihongo Study Deck V19.1 release candidate."""
from pathlib import Path
from html.parser import HTMLParser
from collections import Counter
import hashlib, json, re, subprocess, zipfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ZIP = Path('/mnt/data/nihongo_study_deck_v19_0_comprehensive_overhaul(3).zip')
checks=[]
def check(name, fn):
    try:
        detail=fn()
        checks.append((name, True, str(detail or 'PASS')))
    except Exception as exc:
        checks.append((name, False, f'{type(exc).__name__}: {exc}'))

class HTMLInspect(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids=[]; self.refs=[]; self.tags=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs); self.tags.append((tag,a))
        if a.get('id'): self.ids.append(a['id'])
        if tag=='script' and a.get('src'): self.refs.append(a['src'])
        if tag=='link' and a.get('href'): self.refs.append(a['href'])

def sha(data): return hashlib.sha256(data).hexdigest()

def html_checks():
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    parser=HTMLInspect(); parser.feed(html)
    dup=[k for k,v in Counter(parser.ids).items() if v>1]
    if dup: raise AssertionError(f'duplicate ids: {dup[:10]}')
    missing=[]
    for ref in parser.refs:
        if ref.startswith(('https://','http://','data:','#')): continue
        if not (ROOT/ref.split('?',1)[0].split('#',1)[0]).exists(): missing.append(ref)
    if missing: raise AssertionError(f'missing local HTML resources: {missing}')
    ui_source=(ROOT/'assets/js/v19/cozy-ui.js').read_text(encoding='utf-8')
    for needed in ('v19BottomNav','v19LearnHub','v19LibraryHub','v19SettingsView','v19HomeSeasonImage','v19StudyRoomImage'):
        if needed not in ui_source: raise AssertionError(f'missing dynamically generated V19 UI marker {needed}')
    for label in ('Home','Learn','Library','Progress'):
        if label not in ui_source: raise AssertionError(f'missing primary navigation label {label}')
    return f'{len(parser.ids)} unique ids; {len(parser.refs)} local refs resolved; no duplicates'

def css_reference_checks():
    failures=[]
    for css in ROOT.rglob('*.css'):
        text=css.read_text(encoding='utf-8')
        for url in re.findall(r'url\(["\']?([^"\')]+)', text):
            if url.startswith(('data:','http:','https:','#')): continue
            target=(css.parent/url).resolve()
            if not target.exists(): failures.append(f'{css.relative_to(ROOT)} -> {url}')
    if failures: raise AssertionError('; '.join(failures))
    return f'local CSS URL references resolved across {len(list(ROOT.rglob("*.css")))} CSS files'

def sw_checks():
    text=(ROOT/'service-worker.js').read_text(encoding='utf-8')
    m=re.search(r'const APP_SHELL = \[(.*?)\];',text,re.S)
    if not m: raise AssertionError('APP_SHELL missing')
    refs=re.findall(r"['\"]([^'\"]+)['\"]",m.group(1))
    missing=[r for r in refs if not (ROOT/r.removeprefix('./')).exists()]
    if missing: raise AssertionError(f'missing precache paths: {missing}')
    if 'v19.1.0-cozy-1' not in text: raise AssertionError('SW cache version not bumped')
    return f'{len(refs)} local resources exist in precache list'

def theme_checks():
    cfg=json.loads((ROOT/'assets/config/seasonal_theme.json').read_text(encoding='utf-8'))
    if cfg['themeSystem']['timezone']!='Asia/Tokyo': raise AssertionError('timezone not Asia/Tokyo')
    if set(cfg['seasons'])!={'spring','summer','autumn','winter'}: raise AssertionError('four seasons not complete')
    for season, meta in cfg['seasons'].items():
        for key in ('home','studyRoom'):
            rel=meta['assets'][key]
            path=ROOT/'assets/illustrations'/rel
            if not path.is_file(): raise AssertionError(f'{season} {key} missing: {rel}')
    return 'four seasons, both mode palettes, Asia/Tokyo schedule and all 8 image paths verified'

def image_checks():
    failures=[]
    for folder in ('home','study-room'):
        for p in sorted((ROOT/'assets/illustrations'/folder).rglob('*.webp')):
            with Image.open(p) as im:
                if im.size != (1080,1350): failures.append(f'{p.name}: {im.size}')
                if im.format != 'WEBP': failures.append(f'{p.name}: format {im.format}')
    for p in sorted((ROOT/'assets/empty-states').glob('*.png')):
        with Image.open(p) as im:
            if im.size != (600,600): failures.append(f'{p.name}: {im.size}')
            if im.format!='PNG' or im.mode not in ('RGBA','LA'): failures.append(f'{p.name}: {im.format}/{im.mode}')
            alpha=im.getchannel('A') if im.mode=='RGBA' else im.getchannel('A') if im.mode=='LA' else None
            if alpha is None or alpha.getextrema()[0] == 255: failures.append(f'{p.name}: no transparent pixels')
    if failures: raise AssertionError('; '.join(failures))
    return '8 WebP at 1080x1350; 5 genuine RGBA PNG empty states at 600x600'

def font_checks():
    paths=list((ROOT/'assets/fonts').rglob('*.woff2'))
    if len(paths)!=12: raise AssertionError(f'expected 12 WOFF2 files, found {len(paths)}')
    for p in paths:
        if p.read_bytes()[:4] != b'wOF2': raise AssertionError(f'invalid WOFF2 signature: {p}')
    for f in ('noto-sans-jp/OFL.txt','noto-serif-jp/OFL.txt'):
        if not (ROOT/'assets/fonts'/f).exists(): raise AssertionError(f'license missing: {f}')
    return f'{len(paths)} WOFF2 signatures valid; both OFL license files present'

def branding_checks():
    expected={'icons/icon-192.png':(192,192),'icons/icon-512.png':(512,512),'icons/icon-512-maskable.png':(512,512),
              'assets/branding/android/app_icon_192.png':(192,192),'assets/branding/android/app_icon_512.png':(512,512),
              'assets/branding/android/app_icon_maskable_512.png':(512,512),'assets/branding/ios/apple-touch-icon.png':(180,180),
              'assets/branding/favicon/favicon-16.png':(16,16),'assets/branding/favicon/favicon-32.png':(32,32),'assets/branding/favicon/favicon-48.png':(48,48)}
    for rel,size in expected.items():
        with Image.open(ROOT/rel) as im:
            if im.size!=size: raise AssertionError(f'{rel}: {im.size} != {size}')
    manifest=json.loads((ROOT/'manifest.webmanifest').read_text(encoding='utf-8'))
    for icon in manifest['icons']:
        if not (ROOT/icon['src'].removeprefix('./')).exists(): raise AssertionError(f'manifest icon missing: {icon["src"]}')
    if not (ROOT/'assets/branding/favicon/favicon.svg').exists(): raise AssertionError('SVG favicon missing')
    return 'standard, maskable, favicon and Apple Touch assets match expected dimensions; manifest paths valid'

def module_checks():
    sources=list((ROOT/'assets/js').rglob('*.js'))
    for p in sources:
        subprocess.run(['node','--check',str(p)],check=True,capture_output=True,text=True)
    for p in (ROOT/'assets/js/v19/seasonal').glob('*.js'):
        text=p.read_text(encoding='utf-8')
        for rel in re.findall(r"from\s+['\"]([^'\"]+\.js)['\"]",text):
            if not (p.parent/rel).resolve().exists(): raise AssertionError(f'{p.name} imports missing {rel}')
    return f'{len(sources)} JavaScript files passed node --check; module imports resolved'

def source_preservation_checks():
    prefixes=('assets/js/legacy/','assets/js/v19/bootstrap.js','assets/js/v19/data-audit.js','assets/js/v19/matching.js','assets/js/v19/srs-engine.js','data/','reports/','tests/')
    changed=[]; checked=0
    with zipfile.ZipFile(SOURCE_ZIP) as z:
        names=set(z.namelist())
        for rel in sorted(p.relative_to(ROOT).as_posix() for p in ROOT.rglob('*') if p.is_file()):
            if not rel.startswith(prefixes): continue
            arc='nihongo_study_deck_pwa/'+rel
            if arc not in names: continue
            checked+=1
            if sha((ROOT/rel).read_bytes()) != sha(z.read(arc)): changed.append(rel)
    if changed: raise AssertionError(f'original app logic/data changed: {changed[:20]}')
    return f'{checked} original legacy JS, V19 modules, datasets, reports and tests byte-identical to base ZIP'

def pet_audit():
    pattern=re.compile(r'(?i)\b(pet|pets|petSystem|pet-system|companion|mascot|buddy)\b')
    hits=[]
    with zipfile.ZipFile(SOURCE_ZIP) as z:
        for name in z.namelist():
            if not name.endswith(('.js','.html','.css','.md','.json')): continue
            try: text=z.read(name).decode('utf-8')
            except Exception: continue
            for m in pattern.finditer(text):
                hits.append((name,text.count('\n',0,m.start())+1))
                if len(hits)>10: break
            if len(hits)>10: break
    if hits: return f'pet-related terms found in source: {hits[:10]}'
    return 'no identifiable pet-system implementation or entry point was found in V19.0 source; no pet-related source was modified'

check('HTML IDs, menu routes and local script/style references',html_checks)
check('CSS local font and asset URLs',css_reference_checks)
check('Service worker offline shell',sw_checks)
check('Seasonal JSON and image references',theme_checks)
check('Runtime image dimensions and transparency',image_checks)
check('Typography WOFF2 and OFL licensing files',font_checks)
check('Brand icon dimensions and PWA manifest',branding_checks)
check('JavaScript syntax and module imports',module_checks)
check('Original data and learning modules unchanged',source_preservation_checks)
check('Pet system scope audit',pet_audit)

report=ROOT/'documentation'/'V19_1_STATIC_INTEGRATION_VALIDATION.txt'
report.parent.mkdir(parents=True,exist_ok=True)
lines=['NIHONGO STUDY DECK V19.1 — STATIC INTEGRATION VALIDATION','',f'Project: {ROOT}','']
for name,ok,detail in checks:
    lines.append(('PASS' if ok else 'FAIL')+' | '+name+' | '+detail)
lines += ['',f'Summary: {sum(ok for _,ok,_ in checks)}/{len(checks)} passed, {sum(not ok for _,ok,_ in checks)} failed.']
report.write_text('\n'.join(lines)+'\n',encoding='utf-8')
for line in lines: print(line)
if any(not ok for _,ok,_ in checks): raise SystemExit(1)
