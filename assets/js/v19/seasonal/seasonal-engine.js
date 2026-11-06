import { getNextSeasonBoundary, getSeasonForDate, getDatePartsInTimeZone, JAPAN_TIME_ZONE } from './seasonal-date.js';
import { applyCssTokenMap, getAppearanceModeTokens, mapTokensToCss, resolveAppearanceMode } from './seasonal-token-mapper.js';
import { validateSeasonalConfig } from './seasonal-validator.js';

const MAX_TIMER_DELAY = 2_147_000_000;
const STYLE_ELEMENT_ID = 'nihongo-seasonal-engine-transition-styles';
const DEFAULT_ANIMATED_PROPERTIES = ['color', 'background-color', 'border-color', 'fill', 'stroke'];

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function getTimerHost(windowRef) {
  if (windowRef && typeof windowRef.setTimeout === 'function') return windowRef;
  return globalThis;
}

function ensureTransitionStyles(documentRef, transition) {
  if (!documentRef?.createElement) return null;
  const existing = documentRef.getElementById?.(STYLE_ELEMENT_ID);
  if (existing) return existing;
  const animated = Array.isArray(transition?.animatedProperties)
    ? transition.animatedProperties.filter(value => DEFAULT_ANIMATED_PROPERTIES.includes(value))
    : DEFAULT_ANIMATED_PROPERTIES;
  if (!animated.length) return null;
  const style = documentRef.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.dataset.seasonalEngine = 'true';
  style.textContent = `
html[data-seasonal-engine-ready="true"] [data-seasonal-transition] {
  transition-property: ${animated.join(', ')};
  transition-duration: var(--season-transition-duration, 900ms);
  transition-timing-function: var(--season-transition-easing, ease-in-out);
}
@media (prefers-reduced-motion: reduce) {
  html[data-seasonal-engine-ready="true"] [data-seasonal-transition] {
    transition-duration: 0ms !important;
  }
}
`;
  const host = documentRef.head || documentRef.documentElement;
  host?.append?.(style);
  return style;
}

function snapshotEvent({ previousSeason, season, previousMode, mode, reason, date, timeZone, assets }) {
  return Object.freeze({
    previousSeason: previousSeason ?? null,
    currentSeason: season,
    previousAppearanceMode: previousMode ?? null,
    appearanceMode: mode,
    timestamp: date.toISOString(),
    timeZone,
    automatic: true,
    reason,
    assets: cloneJson(assets),
    changed: previousSeason !== season || previousMode !== mode
  });
}

/**
 * Create a standalone seasonal theme engine.
 * The engine only writes --season-* CSS custom properties and root data attributes;
 * it never changes the app's saved light/dark preference or legacy CSS variables.
 */
export function createSeasonalThemeEngine(options = {}) {
  const {
    config,
    rootElement = globalThis.document?.documentElement,
    documentRef = rootElement?.ownerDocument || globalThis.document,
    windowRef = documentRef?.defaultView || globalThis.window,
    now = () => new Date(),
    appearanceModeResolver = resolveAppearanceMode,
    scheduleBoundaryChecks = true,
    onError = error => globalThis.console?.error?.('[Nihongo Seasonal Engine]', error),
    MutationObserverImpl = windowRef?.MutationObserver || globalThis.MutationObserver
  } = options;

  const validation = validateSeasonalConfig(config);
  if (!validation.valid) {
    const error = new Error(`Invalid seasonal configuration: ${validation.errors.join(' ')}`);
    error.name = 'SeasonalConfigurationError';
    error.validation = validation;
    throw error;
  }
  if (!rootElement || !rootElement.style || typeof rootElement.style.setProperty !== 'function') {
    throw new TypeError('A rootElement with style.setProperty is required.');
  }

  const timeZone = config.themeSystem.timezone || JAPAN_TIME_ZONE;
  const subscribers = new Set();
  const timerHost = getTimerHost(windowRef);
  let timerId = null;
  let started = false;
  let currentSeason = null;
  let currentAppearanceMode = null;
  let lastAppliedAt = null;
  let lastError = null;
  let observer = null;
  let mediaQuery = null;
  let mediaQueryListener = null;
  let initialApplyComplete = false;
  let lastTokens = null;

  const transition = config.transition || {};

  function reportError(error) {
    lastError = error instanceof Error ? error : new Error(String(error));
    try { onError?.(lastError); } catch { /* An error reporter must not break the engine. */ }
    return lastError;
  }

  function readNow() {
    const value = now();
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new TypeError('The engine clock must return a valid Date.');
    return value;
  }

  function getMode() {
    let mode = appearanceModeResolver(rootElement);
    const supported = config.themeSystem.appearanceMode?.supportedModes || ['light', 'dark'];
    if (!supported.includes(mode)) mode = rootElement.classList?.contains?.('dark-theme') ? 'dark' : 'light';
    if (!supported.includes(mode)) throw new Error(`Unsupported appearance mode resolved: ${mode}`);
    return mode;
  }

  function isReducedMotion() {
    try {
      if (!mediaQuery && typeof windowRef?.matchMedia === 'function') {
        mediaQuery = windowRef.matchMedia(transition.reducedMotionMediaQuery || '(prefers-reduced-motion: reduce)');
      }
      return Boolean(mediaQuery?.matches);
    } catch {
      return false;
    }
  }

  function getTransitionDuration(isInitial) {
    if (isInitial || transition.enabled === false) return 0;
    if (isReducedMotion()) return Number(transition.reducedMotionDurationMs ?? 0);
    return Number(transition.durationMs ?? 0);
  }

  function applyVariablesAtomically(cssVariables, durationMs) {
    const entries = Object.entries({
      ...cssVariables,
      '--season-transition-duration': `${durationMs}ms`,
      '--season-transition-easing': transition.easing || 'ease-in-out'
    });
    const oldValues = new Map();
    for (const [property] of entries) {
      oldValues.set(property, typeof rootElement.style.getPropertyValue === 'function' ? rootElement.style.getPropertyValue(property) : '');
    }
    try {
      applyCssTokenMap(rootElement, Object.fromEntries(entries));
    } catch (error) {
      for (const [property, previous] of oldValues) {
        try {
          if (previous) rootElement.style.setProperty(property, previous);
          else rootElement.style.removeProperty?.(property);
        } catch { /* Best-effort rollback. */ }
      }
      throw error;
    }
  }

  function notify(event) {
    for (const callback of [...subscribers]) {
      try { callback(event); } catch (error) { reportError(error); }
    }
    try {
      const CustomEventCtor = windowRef?.CustomEvent || globalThis.CustomEvent;
      if (CustomEventCtor && typeof rootElement.dispatchEvent === 'function') {
        rootElement.dispatchEvent(new CustomEventCtor('nihongo:seasonal-theme-change', { detail: event }));
      }
    } catch (error) { reportError(error); }
  }

  function applyCurrent({ reason = 'refresh', force = false, initial = false } = {}) {
    try {
      const instant = readNow();
      const season = getSeasonForDate(instant, config, timeZone);
      const mode = getMode();
      const metadata = config.seasons[season];
      const tokens = getAppearanceModeTokens(metadata, mode);
      const cssVariables = mapTokensToCss(tokens, config.cssBinding);
      const changed = currentSeason !== season || currentAppearanceMode !== mode;
      if (!changed && !force) return getState();

      const duration = getTransitionDuration(initial || !initialApplyComplete);
      applyVariablesAtomically(cssVariables, duration);
      rootElement.setAttribute?.('data-season', season);
      rootElement.setAttribute?.('data-season-appearance', mode);
      rootElement.setAttribute?.('data-seasonal-engine-ready', 'true');

      const previousSeason = currentSeason;
      const previousMode = currentAppearanceMode;
      currentSeason = season;
      currentAppearanceMode = mode;
      lastAppliedAt = instant.toISOString();
      lastTokens = cloneJson(tokens);
      lastError = null;
      const wasInitial = !initialApplyComplete;
      initialApplyComplete = true;

      if (changed || wasInitial) {
        notify(snapshotEvent({
          previousSeason,
          season,
          previousMode,
          mode,
          reason,
          date: instant,
          timeZone,
          assets: metadata.assets
        }));
      }
      return getState();
    } catch (error) {
      reportError(error);
      return getState();
    }
  }

  function clearBoundaryTimer() {
    if (timerId !== null) {
      timerHost.clearTimeout(timerId);
      timerId = null;
    }
  }

  function scheduleNextBoundary() {
    clearBoundaryTimer();
    if (!started || !scheduleBoundaryChecks || documentRef?.visibilityState === 'hidden') return;
    try {
      const instant = readNow();
      const boundary = getNextSeasonBoundary(instant, config, timeZone);
      const remaining = Math.max(1, boundary.date.getTime() - instant.getTime());
      const delay = Math.min(remaining, MAX_TIMER_DELAY);
      timerId = timerHost.setTimeout(() => {
        timerId = null;
        applyCurrent({ reason: 'calendar-date-recheck' });
        scheduleNextBoundary();
      }, delay);
    } catch (error) {
      reportError(error);
    }
  }

  function refreshFromLifecycle(reason) {
    applyCurrent({ reason });
    scheduleNextBoundary();
  }

  function handleVisibilityChange() {
    if (documentRef?.visibilityState === 'hidden') clearBoundaryTimer();
    else refreshFromLifecycle('visibility-resume');
  }

  function handleMotionPreferenceChange() {
    applyCurrent({ reason: 'reduced-motion-change', force: true });
  }

  function addListener(target, type, callback) {
    if (!target?.addEventListener) return null;
    target.addEventListener(type, callback);
    return () => target.removeEventListener?.(type, callback);
  }

  const removers = [];

  function attachLifecycle() {
    const removeVisibility = addListener(documentRef, 'visibilitychange', handleVisibilityChange);
    const removePageShow = addListener(windowRef, 'pageshow', () => refreshFromLifecycle('page-show'));
    const removeFocus = addListener(windowRef, 'focus', () => refreshFromLifecycle('window-focus'));
    [removeVisibility, removePageShow, removeFocus].filter(Boolean).forEach(fn => removers.push(fn));

    if (typeof MutationObserverImpl === 'function') {
      try {
        observer = new MutationObserverImpl(() => applyCurrent({ reason: 'appearance-mode-change' }));
        observer.observe(rootElement, { attributes: true, attributeFilter: ['class'] });
      } catch (error) {
        observer = null;
        reportError(error);
      }
    }

    try {
      if (typeof windowRef?.matchMedia === 'function') {
        mediaQuery = windowRef.matchMedia(transition.reducedMotionMediaQuery || '(prefers-reduced-motion: reduce)');
        mediaQueryListener = handleMotionPreferenceChange;
        if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', mediaQueryListener);
        else mediaQuery.addListener?.(mediaQueryListener);
      }
    } catch (error) { reportError(error); }
  }

  function detachLifecycle() {
    for (const remove of removers.splice(0)) {
      try { remove(); } catch (error) { reportError(error); }
    }
    observer?.disconnect?.();
    observer = null;
    if (mediaQuery && mediaQueryListener) {
      try {
        if (mediaQuery.removeEventListener) mediaQuery.removeEventListener('change', mediaQueryListener);
        else mediaQuery.removeListener?.(mediaQueryListener);
      } catch (error) { reportError(error); }
    }
    mediaQueryListener = null;
  }

  function getCurrentTheme() {
    if (!currentSeason) return null;
    return {
      season: currentSeason,
      appearanceMode: currentAppearanceMode,
      metadata: cloneJson(config.seasons[currentSeason]),
      tokens: cloneJson(lastTokens)
    };
  }

  function getState() {
    return {
      started,
      currentSeason,
      appearanceMode: currentAppearanceMode,
      timeZone,
      lastAppliedAt,
      nextSeasonBoundary: currentSeason ? (() => {
        try {
          const boundary = getNextSeasonBoundary(readNow(), config, timeZone);
          return { season: boundary.season, at: boundary.date.toISOString() };
        } catch { return null; }
      })() : null,
      lastError: lastError ? lastError.message : null
    };
  }

  const engine = {
    start() {
      if (started) return engine;
      started = true;
      ensureTransitionStyles(documentRef, transition);
      attachLifecycle();
      applyCurrent({ reason: 'application-start', initial: true, force: true });
      scheduleNextBoundary();
      return engine;
    },
    stop() {
      if (!started) return engine;
      started = false;
      clearBoundaryTimer();
      detachLifecycle();
      return engine;
    },
    refresh() {
      applyCurrent({ reason: 'manual-refresh' });
      scheduleNextBoundary();
      return getState();
    },
    getCurrentSeason() { return currentSeason || getSeasonForDate(readNow(), config, timeZone); },
    getCurrentTheme,
    getSeasonMetadata(season) { return config.seasons[season] ? cloneJson(config.seasons[season]) : null; },
    getSeasonalAssets() { return currentSeason ? cloneJson(config.seasons[currentSeason].assets) : null; },
    getHomeAsset() { return currentSeason ? config.seasons[currentSeason].assets.home : null; },
    getStudyRoomAsset() { return currentSeason ? config.seasons[currentSeason].assets.studyRoom : null; },
    getNextSeasonBoundary() {
      const boundary = getNextSeasonBoundary(readNow(), config, timeZone);
      return { season: boundary.season, date: new Date(boundary.date.getTime()) };
    },
    validateConfiguration() { return cloneJson(validation); },
    subscribe(callback) {
      if (typeof callback !== 'function') throw new TypeError('subscribe(callback) requires a function.');
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    getState
  };

  return Object.freeze(engine);
}

export { validateSeasonalConfig } from './seasonal-validator.js';
