# Agape Kids

Agape Kids is a mobile-first children's church management app for Agape Christian Centre in Louis Trichardt.

It keeps the app name exactly as `Agape Kids` and upgrades the project into a more polished church operations tool with:

- child registration and richer family profiles
- class grouping with colour-coded visibility
- safer check-in and pickup verification
- attendance history and absentee follow-up
- volunteer, class, and event visibility
- church polls with lightweight duplicate-vote protection
- Sunday summary reporting and workbook exports
- offline-first local storage with optional Google Sheets + Apps Script sync
- installable PWA support
- Capacitor Android packaging and APK workflow support

## Main Screens

- `Dashboard`: today's attendance, follow-up, active polls, volunteers, classes, and alerts
- `Children`: registration, medical alerts, pickup codes, pastoral notes, attendance history
- `Check-In`: today's workflow, pending pickups, checked-out children, absentee follow-up
- `Ministry`: classes, volunteers, rooms, and events
- `Polls`: create, vote, share to WhatsApp, and export results
- `Reports`: trends, birthdays, absentee list, and workbook export
- `Settings`: branding, language, role mode, sync, backup, and safety defaults

## Project Structure

```text
index.html
styles.css
manifest.json
service-worker.js
apps-script.gs
js/
  api.js
  app.js
  checkin.js
  children.js
  dashboard.js
  ministry.js
  polls.js
  reports.js
  settings.js
  storage.js
  utils.js
icons/
scripts/
tests/
android/
www/
```

## Local Development

Install dependencies:

```bash
npm install
```

Build web assets and sync `www/`:

```bash
npm run build
```

Preview locally:

```bash
python -m http.server 8000
```

Open:

```text
http://localhost:8000
```

Run end-to-end tests:

```bash
npm run test:e2e
```

## Android APK

Sync the Capacitor Android project:

```bash
npm run cap:sync
```

Build a debug APK on Windows:

```bash
npm run apk:debug
```

The local APK output will be:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Google Sheets + Apps Script

Copy `apps-script.gs` into a Google Apps Script project attached to your spreadsheet, deploy it as a web app, then paste the web app URL into Agape Kids Settings.

Created or expected sheets:

- `Children`
- `Attendance`
- `Classes`
- `Volunteers`
- `Events`
- `Polls`
- `PollVotes`

The script supports:

- `health`
- `bootstrap`
- `syncRecords`

## GitHub Pages

This app stays compatible with GitHub Pages because it is a static web app. Push the repo to `main` and serve the built files from the repository root or the generated `www/` output, depending on your Pages setup.

## Notes

- The app is local-first, so volunteers can keep working when the signal is poor.
- Sync is optional and queue-based, so local changes are not lost if Apps Script is unavailable.
- Poll duplicate prevention is lightweight by design: one vote per device per poll in the current architecture.



