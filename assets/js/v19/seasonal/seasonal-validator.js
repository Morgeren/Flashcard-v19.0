const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const REQUIRED_TOKENS = [
  'primary', 'primary-hover', 'secondary', 'accent', 'background', 'surface',
  'surface-secondary', 'text-primary', 'text-secondary', 'border', 'success',
  'warning', 'error', 'on-primary', 'on-secondary', 'on-accent', 'focus-ring',
  'disabled', 'on-disabled', 'overlay'
];
const HEX_COLOR = /^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/;
const CSS_VARIABLE = /^--[a-zA-Z0-9_-]+$/;

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isSafeRelativeAssetPath(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  if (value.startsWith('/') || value.startsWith('\\') || /^[a-z][a-z0-9+.-]*:/i.test(value)) return false;
  const segments = value.replaceAll('\\', '/').split('/');
  return !segments.some(segment => segment === '..' || segment === '.' || segment === '');
}

function validateDatePoint(point, label, errors, allowLast = false) {
  if (!isPlainObject(point)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  if (!Number.isInteger(point.month) || point.month < 1 || point.month > 12) errors.push(`${label}.month must be an integer from 1 to 12.`);
  const dayValid = Number.isInteger(point.day) && point.day >= 1 && point.day <= 31;
  if (!dayValid && !(allowLast && point.day === 'last')) errors.push(`${label}.day must be a valid positive integer${allowLast ? ' or "last"' : ''}.`);
}

export function validateSeasonalConfig(config) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(config)) return { valid: false, errors: ['Configuration root must be a plain JSON object.'], warnings };
  if (typeof config.schemaVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(config.schemaVersion)) errors.push('schemaVersion must use semantic version format.');
  if (typeof config.application !== 'string' || !config.application.trim()) errors.push('application name is missing.');

  const system = config.themeSystem;
  if (!isPlainObject(system)) errors.push('themeSystem is missing or invalid.');
  else {
    if (system.mode !== 'automatic') errors.push('themeSystem.mode must be "automatic".');
    if (system.manualSeasonOverride !== false) errors.push('themeSystem.manualSeasonOverride must be false.');
    if (typeof system.timezone !== 'string' || !system.timezone.trim()) errors.push('themeSystem.timezone is required.');
    else {
      try { new Intl.DateTimeFormat('en-US', { timeZone: system.timezone }).format(new Date(0)); }
      catch { errors.push(`Unsupported timezone: ${system.timezone}.`); }
    }
    const schedule = system.schedule?.seasons;
    if (!isPlainObject(schedule)) errors.push('themeSystem.schedule.seasons is missing or invalid.');
    else {
      for (const season of SEASONS) {
        const range = schedule[season];
        if (!isPlainObject(range)) {
          errors.push(`Schedule is missing ${season}.`);
          continue;
        }
        validateDatePoint(range.start, `${season}.start`, errors);
        validateDatePoint(range.end, `${season}.end`, errors, true);
      }
    }
    const modes = system.appearanceMode?.supportedModes;
    if (!Array.isArray(modes) || !modes.includes('light') || !modes.includes('dark')) errors.push('Both light and dark appearance modes must be supported.');
  }

  const transition = config.transition;
  if (!isPlainObject(transition)) errors.push('transition configuration is missing.');
  else {
    if (typeof transition.enabled !== 'boolean') errors.push('transition.enabled must be boolean.');
    if (!Number.isFinite(transition.durationMs) || transition.durationMs < 0) errors.push('transition.durationMs must be a non-negative number.');
    if (typeof transition.easing !== 'string' || !transition.easing.trim()) errors.push('transition.easing is required.');
    if (!Number.isFinite(transition.reducedMotionDurationMs) || transition.reducedMotionDurationMs < 0) errors.push('transition.reducedMotionDurationMs must be non-negative.');
    if (transition.animatedProperties && (!Array.isArray(transition.animatedProperties) || transition.animatedProperties.some(x => !['color', 'background-color', 'border-color', 'fill', 'stroke'].includes(x)))) {
      errors.push('transition.animatedProperties contains an unsupported property.');
    }
  }

  const cssBinding = config.cssBinding;
  if (!isPlainObject(cssBinding)) errors.push('cssBinding is missing or invalid.');
  else {
    if (typeof cssBinding.prefix !== 'string' || !cssBinding.prefix.startsWith('--')) errors.push('cssBinding.prefix must be a valid CSS custom-property prefix.');
    if (!isPlainObject(cssBinding.mapping)) errors.push('cssBinding.mapping must be an object.');
    else for (const [token, cssName] of Object.entries(cssBinding.mapping)) {
      if (typeof token !== 'string' || !token.trim() || typeof cssName !== 'string' || !CSS_VARIABLE.test(cssName)) errors.push(`Invalid CSS mapping for token ${token}.`);
    }
  }

  if (!isPlainObject(config.seasons)) errors.push('seasons object is missing.');
  else {
    const expectedKeys = new Set(SEASONS);
    for (const key of Object.keys(config.seasons)) if (!expectedKeys.has(key)) warnings.push(`Unknown season "${key}" will not be used by the seasonal engine.`);
    for (const season of SEASONS) {
      const entry = config.seasons[season];
      if (!isPlainObject(entry)) {
        errors.push(`Season metadata for ${season} is missing or invalid.`);
        continue;
      }
      if (typeof entry.label !== 'string' || typeof entry.japanese !== 'string' || typeof entry.romaji !== 'string') errors.push(`${season} metadata requires label, japanese, and romaji strings.`);
      if (!isPlainObject(entry.assets)) errors.push(`${season}.assets is missing.`);
      else {
        for (const assetKey of ['home', 'studyRoom']) {
          if (!isSafeRelativeAssetPath(entry.assets[assetKey])) errors.push(`${season}.assets.${assetKey} must be a safe relative path.`);
        }
      }
      if (!isPlainObject(entry.colorModes)) {
        errors.push(`${season}.colorModes is missing.`);
        continue;
      }
      for (const mode of ['light', 'dark']) {
        const tokens = entry.colorModes[mode]?.tokens;
        if (!isPlainObject(tokens)) {
          errors.push(`${season}.colorModes.${mode}.tokens is missing.`);
          continue;
        }
        for (const token of REQUIRED_TOKENS) if (!(token in tokens)) errors.push(`${season}.${mode} is missing required token "${token}".`);
        for (const [token, value] of Object.entries(tokens)) {
          if (typeof value !== 'string' || !HEX_COLOR.test(value)) errors.push(`${season}.${mode}.${token} is not a valid 6- or 8-digit hexadecimal color.`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export const REQUIRED_SEASONAL_TOKENS = Object.freeze([...REQUIRED_TOKENS]);
