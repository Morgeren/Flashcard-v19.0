# Nihongo Study Deck V19.1 — Cozy Japanese Countryside (Integration Candidate)

V19.1 is an Android-first UI integration candidate built on the V19.0 Foundation source. It introduces a four-season visual shell while retaining the legacy learning modules and data model. This package is **ready for review and controlled testing**, not yet certified as a production release on physical Android devices.

## Included changes

- Four primary navigation destinations: Home, Learn, Library, and Progress. Settings is accessible through the header as a secondary destination.
- Home hero uses the current seasonal Japanese countryside illustration.
- Learn hub uses the matching seasonal Study Room illustration and links to existing learning routes.
- Library hub provides local vocabulary search, saved vocabulary, links to existing Grammar and Reading routes, and transparent labeling for the limited Kanji index.
- Progress retains the existing V13 progress screen and adds empty-state guidance only when corresponding data is absent.
- Countryside Book branding, local WOFF2 typography, five Empty State illustrations, and seasonal assets are bundled locally.
- Seasonal Engine uses `Asia/Tokyo`, the supplied `seasonal_theme.json`, the existing Light/Dark preference, and 900 ms color transitions with reduced-motion support.
- PWA manifest and service-worker precache were updated for the new runtime assets.

## What was deliberately preserved

- Existing V18/V13/V10/legacy learning scripts and their execution order.
- Vocabulary, Reading, legacy Reading, Kanji index, and Grammar index datasets.
- Existing SRS implementation and review state handling.
- Existing LocalStorage and IndexedDB structures; no destructive clear/delete or reset was added.
- Existing V19 source modules, reports, and regression tests.

The integration validator confirms that 28 compared legacy code, V19 modules, datasets, reports, and test files are byte-identical to the V19.0 base ZIP.

## Build and validation

Requires Python 3.10+ and Node.js. The project does not require an npm build dependency.

```bash
python tools/build.py
python tools/validate.py
python tools/validate_v19_1_integration.py
node --test tests/*.test.mjs
```

Seasonal Engine tests are in the standalone source package under `assets/js/v19/seasonal` in the release; for the full test suite, use the separate Seasonal Engine package or refer to the test report included in this release.

## Run locally

Serve the project over HTTP; do not open `index.html` through `file://`.

```bash
python -m http.server 8000
```

Open `http://localhost:8000`. PWA installation requires HTTPS on a deployed host.

## Important content limitations inherited from V19.0

- `data/kanji-index.json` is an index of 801 characters extracted from vocabulary headwords. It is not a fully verified Kanji dictionary and does not establish complete readings, meanings, stroke counts, or radicals. The Library labels this limitation.
- `data/grammar-index.json` contains 49 extracted patterns; all remain `needs_review`.
- 979 Reading-to-vocabulary references remain unmatched and are not auto-linked through fuzzy matching.
- The source README reports 950 core readings and 6 legacy readings. Language review is still pending for a substantial portion of the corpus.
- A dedicated Writing Practice module is not implemented in the V19.0 foundation.
- A pet-system implementation or entry point was not identifiable in the inspected V19.0 source. No pet-related module was altered; preservation of a pet feature cannot be verified from this base project.

## Test status and known limitations

- V19.0 application automated tests: 11/11 passed.
- Standalone Seasonal Engine automated tests: 30/30 passed.
- V19.1 integration static checks: 10/10 passed.
- Browser visual test via Chromium was blocked by the execution environment; visual browser rendering is therefore **NOT TESTED** here.
- Physical Android install, launcher icon behavior, HTTPS service-worker update, offline relaunch, and real browser migration from an existing user profile are **NOT TESTED**.

Before updating a deployed installation, export a full backup and retain it until the updated app is verified. Deploy to the same origin and scope to preserve same-origin browser storage. Do not clear browser site data.

See `documentation/` for audit, feature matrix, integration reports, validation results, and phase reports.
