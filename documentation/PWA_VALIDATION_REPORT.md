# PWA Validation Report

## Static checks: PASS

- `manifest.webmanifest` parses as JSON.
- Standard icon paths, maskable icon path, favicon paths, and Apple Touch Icon path exist.
- Manifest orientation is `portrait-primary`; display is `standalone`; scope and start URL remain `./`.
- Service worker cache version is `v19.1.0-cozy-1`.
- All 67 local app-shell precache entries exist, including the full static import dependency chain for the V19 bootstrap and Seasonal Engine.
- Runtime fonts and images are local; no external font/image hotlink is required by the new V19.1 shell.
- Existing same-origin navigation fallback and cache-first handling are retained.

## Not tested on deployed environment

- PWA installability over HTTPS.
- Android launcher icon visual mask behavior.
- Installed-app update/reload behavior.
- Offline cold start and offline relaunch after the new worker has installed.
- Cache eviction/storage pressure on entry-level Android devices.
- Migration of existing user data across a live update from the current deployment origin.

Before deployment, export a full application backup, retain it, deploy to the existing HTTPS origin/scope, and test on a separate browser profile or device before relying on the updated application.
