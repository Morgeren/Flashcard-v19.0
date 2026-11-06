#!/usr/bin/env python3
"""Static integrity checks for Nihongo Study Deck V19 foundation build."""
from pathlib import Path
from html.parser import HTMLParser
from collections import Counter
import json, re, sys

ROOT = Path(__file__).resolve().parents[1]
checks = []
def check(name, fn):
    try:
        result = fn()
        ok = result is not False
        detail = 'PASS' if result is None or result is True else str(result)
    except Exception as exc:
        ok, detail = False, f'{type(exc).__name__}: {exc}'
    checks.append((name, ok, detail))

class HTMLInspect(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids=[]; self.src=[]
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if attrs.get('id'): self.ids.append(attrs['id'])
        if tag == 'script' and attrs.get('src'): self.src.append(attrs['src'])
        if tag in ('link',) and attrs.get('href'): self.src.append(attrs['href'])

def parsed(name): return json.loads((ROOT/'data'/name).read_text(encoding='utf-8'))
def html_inspect():
    p=HTMLInspect(); p.feed((ROOT/'index.html').read_text(encoding='utf-8')); return p

def check_html_ids():
    counts=Counter(html_inspect().ids); duplicates=[x for x,n in counts.items() if n>1]
    return f'{len(duplicates)} duplicates: {duplicates[:10]}' if duplicates else True

def check_html_refs():
    missing=[]
    for ref in html_inspect().src:
        if ref.startswith(('http://','https://','data:','#')): continue
        local=(ROOT/ref.split('?',1)[0].split('#',1)[0]).resolve()
        if not local.exists(): missing.append(ref)
    return f'{len(missing)} missing refs: {missing}' if missing else True

def check_vocab():
    rows=parsed('vocabulary.json')
    ids=[str(x.get('id','')) for x in rows]
    required=('japanese','hiragana','meaning','partOfSpeech')
    missing=[x.get('id') for x in rows if not all(str(x.get(k,'')).strip() for k in required)]
    return f'{len(rows)} records; {len(ids)-len(set(ids))} duplicate IDs; {len(missing)} missing core fields' if not missing and len(ids)==len(set(ids)) else f'ID/core-field issues: duplicates={len(ids)-len(set(ids))}, missing={missing[:10]}'

def check_reading():
    rows=parsed('reading.json'); ids=[str(x.get('id','')) for x in rows]
    issues=[]
    for row in rows:
        for q in row.get('questions',[]):
            opts=q.get('options',[]); ans=q.get('answerIndex',q.get('answer'))
            if len(opts)!=4 or not isinstance(ans,int) or ans<0 or ans>=len(opts): issues.append((row.get('id'),q.get('id')))
    return f'{len(rows)} records; {len(ids)-len(set(ids))} duplicate IDs; {len(issues)} invalid question structures' if len(ids)==len(set(ids)) and not issues else f'issues: duplicate IDs={len(ids)-len(set(ids))}, invalid questions={issues[:10]}'

def check_modules():
    files=['matching.js','data-audit.js','srs-engine.js','bootstrap.js']
    missing=[x for x in files if not (ROOT/'assets/js/v19'/x).exists()]
    return f'missing: {missing}' if missing else True

def check_sw_shell():
    sw=(ROOT/'service-worker.js').read_text(encoding='utf-8')
    match=re.search(r'const APP_SHELL = \[(.*?)\];',sw,re.S)
    if not match: return 'APP_SHELL array not found'
    refs=re.findall(r"['\"]([^'\"]+)['\"]",match.group(1))
    missing=[x for x in refs if not (ROOT/x.removeprefix('./')).exists()]
    return f'{len(refs)} resources; missing: {missing}' if missing else f'{len(refs)} resources available'

def check_manifest():
    m=json.loads((ROOT/'manifest.webmanifest').read_text(encoding='utf-8'))
    return True if m.get('name') and m.get('start_url') and m.get('icons') else 'required manifest fields missing'

def check_storage_safety():
    scripts='\n'.join(p.read_text(encoding='utf-8') for p in (ROOT/'assets/js').rglob('*.js'))
    unsafe='localStorage.clear(' in scripts or 'indexedDB.deleteDatabase(' in scripts
    return 'destructive storage clear/delete call detected' if unsafe else 'no destructive storage clear/delete in application JS'

check('Generated index exists', lambda: (ROOT/'index.html').is_file())
check('Vocabulary schema and ID integrity', check_vocab)
check('Reading schema, IDs, and question structure', check_reading)
for name in ['legacy-reading.json','kanji-index.json','grammar-index.json']:
    check(f'{name} parses', lambda name=name: bool(parsed(name)))
check('No duplicate HTML IDs', check_html_ids)
check('All local HTML script/link references exist', check_html_refs)
check('V19 modules exist', check_modules)
check('Service worker pre-cache resources exist', check_sw_shell)
check('PWA manifest parses', check_manifest)
check('No destructive storage clear/delete', check_storage_safety)

for name, ok, detail in checks:
    print(('PASS' if ok else 'FAIL'), name, detail)
sys.exit(1 if any(not ok for _, ok, _ in checks) else 0)
