/**
 * Nihongo Study Deck V19 SRS engine.
 * SM-2-inspired scheduler kept pure and deterministic for testing.
 * Units: interval is days; Again uses 0.01 day (~14.4 minutes), matching V18.6 behavior.
 */
const VALID = new Set(['again','hard','good','easy']);
export function scheduleSrs(previous = {}, rating, now = Date.now()) {
  if (!VALID.has(rating)) throw new TypeError(`Unsupported SRS rating: ${rating}`);
  const oldReps = Math.max(0, Number(previous.repetitions) || 0);
  let repetitions = oldReps;
  let interval = Math.max(0, Number(previous.interval) || 0);
  let easeFactor = Math.min(2.8, Math.max(1.3, Number(previous.easeFactor) || 2.5));
  let lapses = Math.max(0, Number(previous.lapses) || 0);
  if (rating === 'again') {
    repetitions = 0; interval = 0.01; lapses += 1; easeFactor = Math.max(1.3, easeFactor - 0.2);
  } else if (rating === 'hard') {
    repetitions = Math.max(1, oldReps + 1);
    interval = oldReps === 0 ? 1 : Math.max(1, Math.ceil((interval || 1) * 1.2));
    easeFactor = Math.max(1.3, easeFactor - 0.15);
  } else if (rating === 'good') {
    repetitions = oldReps + 1;
    interval = oldReps === 0 ? 1 : oldReps === 1 ? 6 : Math.max(1, Math.round((interval || 1) * easeFactor));
  } else {
    repetitions = oldReps + 1;
    interval = oldReps === 0 ? 4 : Math.max(2, Math.round((interval || 1) * easeFactor * 1.3));
    easeFactor = Math.min(2.8, easeFactor + 0.15);
  }
  let status = 'review';
  if (rating !== 'again' && repetitions >= 3 && interval >= 7) status = 'mastered';
  else if (rating === 'hard') status = 'hard';
  else if (rating === 'again') status = 'again';
  return {
    repetitions, interval,
    easeFactor: Math.round(easeFactor * 100) / 100,
    lapses, status,
    reviewedAt: now,
    dueAt: now + interval * 86400000,
    lastRating: rating
  };
}

export function simulateSrsSequence(ratings, initial = {}, now = Date.UTC(2026,0,1)) {
  let state = {...initial};
  const history = [];
  for (const rating of ratings) {
    state = {...state, ...scheduleSrs(state, rating, now + history.length * 1000)};
    history.push({...state});
  }
  return history;
}
