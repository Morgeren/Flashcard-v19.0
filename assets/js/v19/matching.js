export function normalizeJapanese(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase('ja-JP').replace(/[\s\u3000]+/gu, '');
}

export function buildVocabularyIndex(words) {
  const index = new Map();
  for (const word of Array.isArray(words) ? words : []) {
    const key = normalizeJapanese(word?.japanese);
    if (!key) continue;
    const list = index.get(key) || [];
    list.push(word);
    index.set(key, list);
  }
  return index;
}

export function resolveExactReference(reference, index) {
  const headword = reference?.japanese || reference?.kanji || reference?.word || '';
  const matches = index.get(normalizeJapanese(headword)) || [];
  if (matches.length === 1) return {status:'matched', method:'exact_normalized_headword', confidence:1, word:matches[0]};
  if (matches.length > 1) return {status:'needs_review', method:'ambiguous_exact_headword', confidence:1, candidates:matches};
  return {status:'unmatched', method:null, confidence:0, candidates:[]};
}
