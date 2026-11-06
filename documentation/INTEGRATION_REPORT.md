# V19.1 Integration Report

## Output

V19.1 integration candidate based on the supplied V19.0 Foundation source. The original source archive is not modified.

## Major integration points

- `src/index.template.html`: V19.1 document metadata, local typography and Cozy CSS, local favicon/Apple icon links, and `cozy-ui.js` module entry.
- `assets/js/v19/cozy-ui.js`: four-item navigation shell, Learn/Library hubs, secondary Settings view, seasonal asset binding, conditional Empty States, and route bridge to the existing V13 navigation API.
- `assets/css/v19-cozy.css`: mobile-first styling and semantic token adapter; legacy CSS variables are retained.
- `assets/js/v19/seasonal/*`: existing standalone Seasonal Engine modules.
- `assets/config/seasonal_theme.json`: authoritative schedule/color tokens/image paths.
- `assets/css/typography.css` and `assets/fonts/*`: local Noto Sans JP UI and Noto Serif JP Reading assets.
- `assets/branding/*`: Countryside Book icons and metadata assets.
- `manifest.webmanifest`: V19.1 app identity and icon references.
- `service-worker.js`: cache version bump and local asset precache expansion.

## Feature routes retained

The shell routes into existing features using the V13 `navigate` API. The new navigation does not recreate SRS or the legacy content engines. Full feature-to-destination mapping is in `FEATURE_PRESERVATION_MATRIX.csv`.

## Important data/feature limitations

- Kanji Library entry searches existing vocabulary entries and does not present the extracted index as a verified Kanji dictionary.
- Grammar Reference points to existing Grammar/Grammar Tutor routes; the 49 extracted patterns remain `needs_review`.
- Personal Tutor entry points to the existing sentence-analysis area in the Reader, not a new AI tutor implementation.
- Dedicated Writing Practice is not present in the V19.0 base.
- No pet-system code was identifiable in the supplied base archive; none was modified.

## Release safety

No destructive LocalStorage/IndexedDB operations were added. User data is expected to remain available when updating at the same origin and scope, but a populated user profile migration was not exercised. Export a full backup before deploying.
