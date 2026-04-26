# Google Sheets Setup

1. Create a Google Sheet and copy its ID from URL.
2. Open `script.google.com`, create a new project.
3. Paste code from `google-apps-script.gs`.
4. In Apps Script: `Project Settings` -> `Script properties` -> add:
   - `SPREADSHEET_ID` = your Google Sheet ID
5. Deploy: `Deploy` -> `New deployment` -> type `Web app`:
   - Execute as: `Me`
   - Access: `Anyone`
6. Copy Web App URL ending with `/exec`.
7. Open `api-config.js` and set:

```js
window.WEDDING_API_URL = 'https://script.google.com/macros/s/XXX/exec';
```

After this:
- new RSVP responses go to Google Sheets;
- admin page reads from Google Sheets;
- local old responses migrate one-time with duplicate/tombstone protection.
