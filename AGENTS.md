# AGENTS

## Project shape
- Static wedding site (no build system, no backend): main guest page is `index.html`, admin view is `admin.html`.
- Runtime logic lives in `script.js`; styling is in `style.css`; media assets are local files in repo root.

## Run and verify
- Start with a static server from repo root: `python3 -m http.server 8000`, then open `/index.html` and `/admin.html`.
- There are no automated tests/lint/typecheck configs in this repo; manual browser verification is the source of truth.

## Data flow and admin behavior
- API endpoint is configured in `api-config.js` via `window.WEDDING_API_URL`; when empty, app falls back to local-only mode.
- RSVP submissions are stored in both local backup (`localStorage` key `wedding_responses`) and Google Sheets (if API is configured).
- One-time migration uses `wedding_migrated_fingerprints_v1` and server tombstones so deleted rows are not re-imported from old devices.
- `admin.html` reads/deletes rows through Google Apps Script API (`list`, `delete`); in fallback mode it only sees local browser storage.
- Quiz game stores server results in `QuizResults` sheet via `quiz_submit`, leaderboard uses `quiz_leaderboard`, admin list/delete uses `quiz_list` and `quiz_delete`.
- Admin password is hardcoded in `admin.html` as `123!`.

## Editing gotchas
- `index.html` uses inline `onsubmit="handleSubmit(event)"`; `script.js` must keep `window.handleSubmit` exported globally.
- Keep asset filenames exactly as referenced (including Cyrillic names and spaces); path/name mismatches will break images/audio.
- Visual effects depend on CDN scripts in `index.html` (`three.js`, `gsap`, `ScrollTrigger`); offline mode breaks shader/scroll animations.
