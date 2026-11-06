# Install / Update Notes — Nihongo Study Deck V19.1

1. Keep the current deployed V19.0 files and export a full in-app backup before updating.
2. Retain the backup separately. Do not clear browser site data or delete the existing PWA installation before verifying the update.
3. Deploy the contents of this release to the same HTTPS origin and scope used by the current app. Same-origin storage continuity depends on keeping the origin and scope stable.
4. Open the deployed app online once so the updated service worker can install and cache the V19.1 app shell.
5. Reopen the app and verify Home, Learn, Library, Progress, Settings, Flashcard/SRS, Reading, Listening, Grammar, JLPT, search, saved vocabulary, backup/restore, and the seasonal theme.
6. Test offline relaunch after the service worker is activated. Keep the exported backup until this and data persistence checks are complete.

This package has passed static validation and automated source tests, but a physical Android install, deployed HTTPS update, browser rendering, and offline relaunch were not performed in the build environment.
