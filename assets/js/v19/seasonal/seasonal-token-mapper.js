/** Resolve the appearance mode already active on the application root element. */
export function resolveAppearanceMode(rootElement) {
  const classes = rootElement?.classList;
  if (classes?.contains('dark-theme')) return 'dark';
  if (classes?.contains('light-theme')) return 'light';
  // V19.0's toolbar defaults to light mode for new profiles and uses these root classes.
  return 'light';
}

/** Build CSS variable names from the exact mapping and prefix in seasonal_theme.json. */
export function mapTokensToCss(tokens, cssBinding) {
  if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) throw new TypeError('Theme tokens must be an object.');
  const mapping = cssBinding?.mapping || {};
  const prefix = cssBinding?.prefix || '--season-';
  const result = {};
  for (const [token, value] of Object.entries(tokens)) {
    const cssName = mapping[token] || `${prefix}${token}`;
    if (!/^--[a-zA-Z0-9_-]+$/.test(cssName)) throw new TypeError(`Invalid CSS custom property mapping for ${token}.`);
    result[cssName] = value;
  }
  return result;
}

export function applyCssTokenMap(rootElement, cssVariables) {
  if (!rootElement?.style || typeof rootElement.style.setProperty !== 'function') {
    throw new TypeError('rootElement must expose a style.setProperty method.');
  }
  for (const [property, value] of Object.entries(cssVariables)) rootElement.style.setProperty(property, value);
}

export function getAppearanceModeTokens(seasonMetadata, appearanceMode) {
  const tokens = seasonMetadata?.colorModes?.[appearanceMode]?.tokens;
  if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) {
    throw new Error(`Season does not provide a complete color mode for "${appearanceMode}".`);
  }
  return tokens;
}
