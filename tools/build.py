#!/usr/bin/env python3
"""Build the offline single-page app from modular source and JSON datasets."""
from pathlib import Path
import json, re
ROOT=Path(__file__).resolve().parents[1]
template=(ROOT/'src'/'index.template.html').read_text(encoding='utf-8')
files={'seed-data':'vocabulary.json','v11-core-data':'reading.json','v11-legacy-data':'legacy-reading.json'}
for marker,filename in files.items():
    token=f'<!-- V19_DATA:{marker} -->'
    if token not in template: raise SystemExit(f'Missing template marker: {token}')
    data=json.loads((ROOT/'data'/filename).read_text(encoding='utf-8'))
    tag=f'<script type="application/json" id="{marker}">'+json.dumps(data,ensure_ascii=False,separators=(',',':'))+'</script>'
    template=template.replace(token,tag)
(ROOT/'index.html').write_text(template,encoding='utf-8')
print('Built',ROOT/'index.html','(',len(template.encode('utf-8')),'bytes )')
