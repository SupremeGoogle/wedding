# AGENTS

## Project shape
- Static wedding site (no build system, no backend): main guest page is `index.html`, admin view is `admin.html`.
- Runtime logic lives in `script.js`; styling is in `style.css`; media assets are local files in repo root.

## Run and verify
- Start with a static server from repo root: `python3 -m http.server 8000`, then open `/index.html` and `/admin.html`.
- There are no automated tests/lint/typecheck configs in this repo; manual browser verification is the source of truth.

## Data flow and admin behavior
- RSVP submissions are saved only in browser `localStorage` under key `wedding_responses` (no network/API call).
- `admin.html` reads the same `localStorage` key; data is visible only in the same browser/profile/device origin.
- Admin password is hardcoded in `admin.html` as `123!`.

## Editing gotchas
- `index.html` uses inline `onsubmit="handleSubmit(event)"`; `script.js` must keep `window.handleSubmit` exported globally.
- Keep asset filenames exactly as referenced (including Cyrillic names and spaces); path/name mismatches will break images/audio.
- Visual effects depend on CDN scripts in `index.html` (`three.js`, `gsap`, `ScrollTrigger`); offline mode breaks shader/scroll animations.
