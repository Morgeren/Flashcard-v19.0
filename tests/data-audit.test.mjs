import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditDatasets,makeUnmatchedQueue} from '../assets/js/v19/data-audit.js';
const read = async name => JSON.parse(await readFile(new URL(`../data/${name}`,import.meta.url),'utf8'));
test('V19 source datasets retain expected V18.7 record counts',async()=>{
 const [v,r,l]=await Promise.all([read('vocabulary.json'),read('reading.json'),read('legacy-reading.json')]);
 assert.equal(v.length,1205);assert.equal(r.length,950);assert.equal(l.length,6);
});
test('Reading vocabulary references use only verified exact links',async()=>{
 const [v,r,l]=await Promise.all([read('vocabulary.json'),read('reading.json'),read('legacy-reading.json')]);
 const report=auditDatasets(v,r,l);
 assert.equal(report.vocabularyReferences.total,3330);
 assert.equal(report.vocabularyReferences.matched,2351);
 assert.equal(report.vocabularyReferences.unmatched,979);
 const ids=new Set(v.map(x=>String(x.id)));
 for(const p of [...r,...l]) for(const ref of p.vocabulary||[]) {
  if(ref.linkStatus==='matched') {assert.ok(ids.has(String(ref.canonicalWordId)));assert.equal(ref.matchMethod,'exact_normalized_headword');}
  else assert.equal(ref.canonicalWordId,null);
 }
});
test('Reading question structure and vocabulary core fields are valid',async()=>{
 const [v,r,l]=await Promise.all([read('vocabulary.json'),read('reading.json'),read('legacy-reading.json')]);
 const report=auditDatasets(v,r,l);
 assert.equal(report.vocabulary.missingCoreFields,0);
 assert.equal(report.vocabulary.duplicateIds,0);
 assert.equal(report.reading.duplicateIds,0);
 assert.equal(report.reading.invalidQuestions,0);
});
test('Unmatched vocabulary queue remains explicit and reviewable',async()=>{
 const [r,l]=await Promise.all([read('reading.json'),read('legacy-reading.json')]);
 const queue=makeUnmatchedQueue(r,l);assert.equal(queue.length,979);assert.ok(queue.some(x=>x.term));
});
test('Kanji/grammar indexes do not claim automatic verification',async()=>{
 const [k,g]=await Promise.all([read('kanji-index.json'),read('grammar-index.json')]);
 assert.ok(k.records.length>0);assert.ok(g.records.length>=40);
 assert.ok(k.records.every(x=>x.reviewStatus==='needs_review'));
 assert.ok(g.records.every(x=>x.reviewStatus==='needs_review'));
});
