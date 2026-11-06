import {auditDatasets, makeUnmatchedQueue} from './data-audit.js';
import {scheduleSrs, simulateSrsSequence} from './srs-engine.js';

const $ = id => document.getElementById(id);
const readJSON = id => { const el=$(id); if(!el) throw new Error(`Dataset ${id} tidak ditemukan`); return JSON.parse(el.textContent||'[]'); };
const download = (name, data, mime='application/json') => { const blob=new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type:mime}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); };
const escapeHTML = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function render(report, unmatched) {
  if ($('v19IntegrityCard')) return;
  const host=$('v187DataPanel'); if(!host) return false;
  let style=$('v19IntegrityStyle');
  if(!style){style=document.createElement('style');style.id='v19IntegrityStyle';}
  style.textContent=`
  .v19-integrity-card{border:1px solid var(--line);border-radius:16px;padding:16px;margin:14px 0;background:var(--panel);color:var(--text)}
  .v19-integrity-card h3{margin:0 0 4px;font-size:1.05rem}.v19-integrity-muted{color:var(--muted);font-size:.84rem;line-height:1.5;margin:4px 0 12px}
  .v19-integrity-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:9px;margin:12px 0}
  .v19-integrity-metric{background:var(--panel2);border:1px solid var(--line);border-radius:11px;padding:11px;min-width:0}
  .v19-integrity-metric strong{display:block;font-size:1.35rem;font-variant-numeric:tabular-nums}.v19-integrity-metric span{font-size:.78rem;color:var(--muted)}
  .v19-integrity-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.v19-integrity-actions button{min-height:40px}
  .v19-integrity-card details{margin-top:12px;border-top:1px solid var(--line);padding-top:10px}.v19-integrity-card li{margin:5px 0;font-size:.82rem;overflow-wrap:anywhere}
  .v19-reader-vocab-row{padding:5px 0;border-bottom:1px dashed var(--line)}.v19-reader-save{font-size:.75rem;padding:4px 8px;min-height:30px;margin:3px 0 3px 5px}
  .v19-integrity-status{display:inline-block;padding:4px 8px;border-radius:999px;background:var(--panel2);font-size:.75rem}
  `; if(!style.isConnected)document.head.append(style);
  const card=document.createElement('section'); card.className='v19-integrity-card'; card.id='v19IntegrityCard';
  const matched=report.vocabularyReferences.matched, total=report.vocabularyReferences.total;
  const pct=total?Math.round(matched/total*1000)/10:0;
  const statusList=Object.entries(report.reading.reviewStatuses).map(([k,v])=>`${k}: ${v}`).join(' · ');
  card.innerHTML=`<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><h3>V19.0 · Integritas Data & Kualitas Materi</h3><p class="v19-integrity-muted">Fondasi pemeliharaan data. Status linguistik tidak dinyatakan terverifikasi hanya dari pemeriksaan struktur.</p></div><span class="v19-integrity-status">Foundation build</span></div>
   <div class="v19-integrity-grid">
    <div class="v19-integrity-metric"><strong>${report.vocabulary.total.toLocaleString('id-ID')}</strong><span>Entri kosakata</span></div>
    <div class="v19-integrity-metric"><strong>${report.vocabulary.withValidExamples.toLocaleString('id-ID')} / ${report.vocabulary.total.toLocaleString('id-ID')}</strong><span>Kosakata dengan contoh Jepang + terjemahan</span></div>
    <div class="v19-integrity-metric"><strong>${report.reading.totalPassages.toLocaleString('id-ID')}</strong><span>Bacaan inti + legacy</span></div>
    <div class="v19-integrity-metric"><strong>${matched.toLocaleString('id-ID')} / ${total.toLocaleString('id-ID')}</strong><span>Referensi kosakata terhubung (${pct}%)</span></div>
    <div class="v19-integrity-metric"><strong>${report.vocabularyReferences.unmatched.toLocaleString('id-ID')}</strong><span>Referensi belum terhubung</span></div>
    <div class="v19-integrity-metric"><strong>${report.reading.invalidQuestions}</strong><span>Soal dengan struktur tidak valid</span></div>
    <div class="v19-integrity-metric"><strong>${report.kanjiIndex.uniqueCharacters.toLocaleString('id-ID')}</strong><span>Karakter kanji terindeks · belum diverifikasi</span></div>
    <div class="v19-integrity-metric"><strong>${report.grammarIndex.uniquePatterns.toLocaleString('id-ID')}</strong><span>Pola grammar terindeks · perlu review</span></div>
   </div>
   <p class="v19-integrity-muted">Status bacaan: ${escapeHTML(statusList||'tidak tersedia')}. Referensi hanya dihubungkan melalui kecocokan headword yang persis setelah normalisasi Unicode; frasa dan bentuk infleksi tidak dipaksakan cocok.</p>
   <p class="v19-integrity-muted">Validasi struktur: <b>${escapeHTML(report.validation.structuralStatus)}</b> · Validasi bahasa Jepang oleh penelaah: <b>NOT TESTED</b> · Promosi status Verified: <b>tidak dilakukan</b>.</p>
   <div class="v19-integrity-actions"><button type="button" id="v19DownloadAudit">Unduh audit JSON</button><button type="button" id="v19DownloadQueue">Unduh antrean matching</button><button type="button" id="v19RefreshAudit">Hitung ulang audit</button></div>
   <details><summary>Lihat contoh referensi yang belum terhubung (${unmatched.length})</summary><ul>${unmatched.slice(0,15).map(x=>`<li><b>${escapeHTML(x.term)}</b> · ${escapeHTML(x.readingTitle)} · ${escapeHTML(x.meaning)} <span class="v19-integrity-muted">(${escapeHTML(x.status)})</span></li>`).join('')}</ul><p class="v19-integrity-muted">Daftar lengkap tersedia melalui tombol unduh antrean matching.</p></details>`;
  host.append(card);
  $('v19DownloadAudit')?.addEventListener('click',()=>download('nihongo-v19-audit-report.json',report));
  $('v19DownloadQueue')?.addEventListener('click',()=>download('nihongo-v19-unmatched-vocabulary.json',unmatched));
  $('v19RefreshAudit')?.addEventListener('click',()=>{card.remove();boot(true)});
  return true;
}

let booted=false;
function boot(force=false){
  if(booted&&!force)return;
  try{
    const vocabulary=readJSON('seed-data'),readings=readJSON('v11-core-data'),legacy=readJSON('v11-legacy-data');
    const report=auditDatasets(vocabulary,readings,legacy); const unmatched=makeUnmatchedQueue(readings,legacy);
    if(render(report,unmatched)){booted=true;}
    window.NihongoStudyDeckV19={version:'19.0.0-foundation',audit:()=>auditDatasets(readJSON('seed-data'),readJSON('v11-core-data'),readJSON('v11-legacy-data')),scheduleSrs,simulateSrsSequence,unmatchedQueue:()=>makeUnmatchedQueue(readJSON('v11-core-data'),readJSON('v11-legacy-data'))};
  }catch(error){console.error('[Nihongo V19]',error);}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot(),{once:true});else boot();
let retries=0;const retry=()=>{if(booted||retries++>80)return;boot();if(!booted)setTimeout(retry,100)};setTimeout(retry,50);
