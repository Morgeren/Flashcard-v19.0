# Phase 3 — PWA and Offline Integration

**Status: static integration completed; real install/offline lifecycle not tested.**

- Updated `manifest.webmanifest` with V19.1 name, portrait orientation, Warm Cream theme/background colors, standard 192/512 icons, and a 512 maskable icon.
- Added local SVG/PNG favicon and Apple Touch Icon links in the source HTML template.
- Updated the service worker cache identifier to `v19.1.0-cozy-1`.
- Expanded the app-shell precache to 67 local resources, including runtime CSS/JS, the complete V19 bootstrap dependency chain (`bootstrap.js`, `data-audit.js`, `matching.js`, `srs-engine.js`), seasonal config, eight WebP illustrations, five Empty State PNGs, branding files, and local WOFF2 subsets.
- Preserved the existing service-worker install, activation, cache cleanup, same-origin fetch, and navigation fallback logic.
- Static checks confirmed that all 67 listed local precache resources exist.

Not tested: HTTPS installation, installed app update prompt/activation, offline first load after installation, offline relaunch on a physical Android device, and cache behavior under an actual deployed origin.
