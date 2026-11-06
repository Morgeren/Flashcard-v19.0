# Phase 2 — UI Integration

**Status: implemented; browser visual verification pending.**

- Added four primary navigation destinations: Home, Learn, Library, Progress.
- Moved Settings to a secondary gear-button entry in the header.
- Home retains the existing V13 Tutor Home content and adds a seasonal countryside hero.
- Learn hub exposes existing Flashcard/SRS, vocabulary quiz, adaptive route, Reading, Grammar, Listening/Shadowing, Personal Tutor route, and JLPT route.
- Library hub exposes local vocabulary search, saved vocabulary, Grammar and Reading routes, and Kanji search through vocabulary entries with an explicit limitation note.
- Progress retains the existing V13 Tutor Progress content and adds an empty state only when tracked learning data is absent.
- Empty Library, Search, Review, Progress, and History illustrations are conditional; the History empty state is prepended so existing history rows are not cleared.
- Flashcard/Reader routes remain legacy focus sessions; they are not replaced with wireframe mockups.

The wireframe is treated as a visual/IA reference only. The app still uses V19.0 as its functional source. A browser render could not be completed in this runtime, so exact visual fidelity and interactive pointer/touch behavior require local browser review.
