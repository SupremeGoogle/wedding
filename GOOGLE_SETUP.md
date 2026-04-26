# Google Sheets Setup

1. Optional: create a Google Sheet manually (or let script create it automatically on first request).
2. Open `script.google.com`, create a new project.
3. Paste code from `google-apps-script.gs`.
4. In Apps Script: `Project Settings` -> `Script properties`:
   - optional `SPREADSHEET_ID` = your Google Sheet ID
   - if missing, script auto-creates `Wedding RSVP Responses` and saves ID itself.
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

## If admin shows "Не удалось загрузить ответы..."

- Recheck deployment access is exactly `Anyone`.
- Use URL ending with `/exec` from the latest deployment.
- After Apps Script code changes, run `Deploy -> Manage deployments -> Edit -> Deploy`.
- Ensure `SPREADSHEET_ID` is set in Script properties.
