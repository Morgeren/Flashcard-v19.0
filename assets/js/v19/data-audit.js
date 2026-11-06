import {buildVocabularyIndex, resolveExactReference} from './matching.js';

const KNOWN_POS = new Set(['noun','verb','i-adjective','na-adjective','adverb','pronoun','conjunction','particle','expression','counter','particle/expression','interjection','prefix','suffix']);
const VALID_REVIEW = new Set(['draft','unreviewed','needs_language_review','reviewed','verified','legacy_unverified','ai_draft_pending_review','needs_review']);

export function auditDatasets(vocabulary, readings, legacyReadings) {
  const words = Array.isArray(vocabulary) ? vocabulary : [];
  const passages = [...(Array.isArray(readings)?readings:[]), ...(Array.isArray(legacyReadings)?legacyReadings:[])];
  const ids = words.map(w=>String(w?.id ?? ''));
  const readingIds = passages.map(p=>String(p?.id ?? ''));
  const examples = words.reduce((n,w)=>n + (Array.isArray(w?.examples) ? w.examples.filter(e=>e?.japanese?.trim?.() && e?.translation?.trim?.()).length : 0),0);
  const wordsWithExamples = words.filter(w=>(w?.examples||[]).some(e=>e?.japanese?.trim?.() && e?.translation?.trim?.())).length;
  const refs = passages.flatMap(p=>(p?.vocabulary||[]).map(v=>({passage:p,reference:v})));
  const linkStatus = refs.reduce((a,x)=>{const s=x.reference?.linkStatus||'unmatched';a[s]=(a[s]||0)+1;return a;},{});
  const index = buildVocabularyIndex(words);
  const duplicateHeadwords = [...index.entries()].filter(([,a])=>a.length>1).map(([headword,a])=>({headword,ids:a.map(x=>x.id)}));
  const duplicateIds = ids.length-new Set(ids).size;
  const duplicateReadingIds = readingIds.length-new Set(readingIds).size;
  const missingCoreFields = words.filter(w=>!['japanese','hiragana','meaning','partOfSpeech'].every(k=>String(w?.[k]??'').trim())).map(w=>w.id);
  const invalidLevels = words.filter(w=>!['N5','N4','N3','N2','N1','Unclassified'].includes(w?.jlpt)).map(w=>({id:w.id,level:w.jlpt}));
  const invalidPos = words.filter(w=>!KNOWN_POS.has(w?.partOfSpeech)).map(w=>({id:w.id,pos:w.partOfSpeech}));
  const invalidQuestions=[];
  for(const p of passages) for(const q of p?.questions||[]) {
    const opts=Array.isArray(q?.options)?q.options:[];
    const ans=q?.answerIndex ?? q?.answer;
    if(opts.length!==4 || !Number.isInteger(ans) || ans<0 || ans>=opts.length) invalidQuestions.push({readingId:p.id,questionId:q?.id,optionCount:opts.length,answerIndex:ans});
  }
  const reviewStatuses=passages.reduce((a,p)=>{const s=p?.contentReviewStatus||p?.verificationStatus||'unreviewed';a[s]=(a[s]||0)+1;return a;},{});
  return {
    generatedAt:new Date().toISOString(),
    vocabulary:{total:words.length,uniqueIds:new Set(ids).size,duplicateIds,missingCoreFields:missingCoreFields.length,missingCoreFieldIds:missingCoreFields,withValidExamples:wordsWithExamples,withoutValidExamples:words.length-wordsWithExamples,validExampleRecords:examples,duplicateHeadwords:duplicateHeadwords.length,duplicateHeadwordDetails:duplicateHeadwords,invalidLevels,invalidPartOfSpeech:invalidPos},
    reading:{corePassages:(readings||[]).length,legacyPassages:(legacyReadings||[]).length,totalPassages:passages.length,uniqueIds:new Set(readingIds).size,duplicateIds:duplicateReadingIds,reviewStatuses,invalidQuestions:invalidQuestions.length,invalidQuestionDetails:invalidQuestions},
    vocabularyReferences:{total:refs.length,linkStatus,matched:linkStatus.matched||0,needsReview:linkStatus.needs_review||0,unmatched:linkStatus.unmatched||0,rule:'Exact normalized Japanese headword only; ambiguous/unmatched references are not auto-linked.'},
    validation:{structuralStatus:(duplicateIds||duplicateReadingIds||missingCoreFields.length||invalidQuestions.length)?'WARN':'PASS',linguisticValidation:'NOT_TESTED',reviewStatusPromotion:'NONE'}
  };
}

export function makeUnmatchedQueue(readings, legacyReadings) {
  const rows=[];
  for(const p of [...(readings||[]),...(legacyReadings||[])]) for(const v of p?.vocabulary||[]) if(v?.linkStatus!=='matched') rows.push({readingId:p.id,readingTitle:p.title||'',term:v?.japanese||v?.kanji||'',reading:v?.reading||'',meaning:v?.meaning||'',status:v?.linkStatus||'unmatched',candidateIds:v?.matchCandidates||[]});
  return rows;
}
