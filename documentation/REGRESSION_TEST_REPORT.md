# Phase 4 — Regression and Static Validation

## Automated tests

| Suite | Result |
|---|---:|
| Existing V19.0 Node test suite | 11 passed, 0 failed |
| Seasonal Engine test suite | 30 passed, 0 failed |
| Combined test total | 41 passed, 0 failed |
| V19.1 static integration checks | 10 passed, 0 failed |

## Static integration checks

- 301 unique HTML IDs; no duplicate IDs.
- 22 local HTML refs resolved.
- CSS local font/asset URLs resolved.
- All 67 service-worker precache resources exist.
- Seasonal JSON, both appearance mode palettes, Asia/Tokyo schedule, and eight image references verified.
- Eight runtime WebP images are 1080 × 1350.
- Five Empty State PNGs are 600 × 600 with real RGBA alpha transparency.
- Twelve WOFF2 files have valid WOFF2 signatures; both font license files are present.
- Branding dimensions and manifest paths validated.
- 21 JavaScript files passed `node --check`; module imports resolved.
- 28 compared original legacy JS, V19 modules, datasets, reports, and test files remained byte-identical to the V19.0 base archive.
- Pet-system audit found no identifiable implementation or entry point in the supplied V19.0 source; no pet-related source was changed.

## Not tested

- Browser visual rendering and real touch interactions: Chromium navigation was blocked by the execution environment (`ERR_BLOCKED_BY_ADMINISTRATOR`).
- Physical Android device layout, launcher masks, installability, service-worker update, offline relaunch, and real-profile data migration.
- Semantic correctness of all Japanese vocabulary/grammar/reading content beyond the pre-existing V19.0 structural checks.

This is evidence of code/static consistency, not a claim of production certification.
