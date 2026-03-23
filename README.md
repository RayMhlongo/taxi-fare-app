# InsightRide

InsightRide is an offline-first driver operations app for South African taxi drivers, powered by Data Insights by Ray.

It helps drivers and small operators:

- log trips
- log expenses
- attach and view local receipt images
- track profit and daily cash-up totals
- manage regular and monthly customers
- link trips to customers
- generate polished customer invoice PDFs
- export business reports and backups

The app remains lightweight, local-first, and suitable for mobile web and Capacitor Android packaging.

## What Changed

This repo has been upgraded from a single-file MVP into a modular app with:

- split HTML, CSS, and focused JavaScript modules
- versioned storage with migration from the old `taxiFareV1` format
- working theme, role, and currency settings
- consistent currency formatting through shared utilities
- safer date filtering with real `Date` handling
- trip and expense editing plus confirmed delete flows
- JSON backup export and full restore import
- customer management and customer-linked trips
- monthly invoice generation with premium PDF themes
- improved reports, dashboard metrics, and daily cash-up insights
- local vendor assets for better offline behavior
- a build step that syncs the web app to `www/` for Capacitor

## Main Features

### Dashboard

- Selected-period income, expenses, and net profit
- Daily cash-up totals
- Cash vs card or mobile collection totals
- Average income per trip
- Earnings per km
- Earnings per hour
- Most profitable route
- Highest expense category
- Best earning day
- 7-day income chart

### Trips

- Create, edit, and delete trips
- Assign trips to customers
- Track pickup, dropoff, passenger, fare, and payment method
- Capture mixed-payment cash portion for better cash-up accuracy
- Preserve legacy imported distance, duration, tips, and notes data where it already exists

### Expenses

- Create, edit, and delete expenses
- Track categories, quantity, amount, and description
- Attach receipt images
- View receipts later offline
- Graceful receipt-storage fallback if image storage fails

### Customers

- Monthly and regular customer profiles
- Phone, email, route notes, company details, tax number, and invoice notes
- Active and inactive status
- Quick jump from customer to invoice builder

### Invoices

- Select a customer and billing date range
- Automatically gather all linked trips in that period
- Manual or generated invoice number
- Issue date, due date, payment terms, and notes
- Driver and business details pulled from settings
- Two PDF themes:
  - Modern Professional
  - Clean Minimal
- Saved invoice archive for re-export and sharing later

### Reports

- Reliable date-range filtering
- Optional customer filter
- Summary cards for trips, income, expenses, and net profit
- Route, payment-method, and expense breakdowns
- XLSX workbook export with summary, trips, expenses, customers, and invoices sheets

### Settings and Role Mode

- Light, dark, or system theme
- Currency selection across the whole app
- Owner, Manager, and Driver role modes
- Backup export, restore import, and clear-data tools

## Project Structure

```text
index.html
styles.css
manifest.json
service-worker.js
js/
  app.js
  storage.js
  utils.js
  trips.js
  expenses.js
  customers.js
  reports.js
  settings.js
  invoices.js
scripts/
  build.mjs
vendor/
www/
```

## Local Development

### Install

```bash
npm install
```

### Build web assets and sync `www/`

```bash
npm run build
```

This copies:

- local source files into `www/`
- browser vendor assets into `vendor/`
- the same assets into `www/vendor/`

### Preview locally

Use any static server from the repo root, for example:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

### Sync to Capacitor Android

```bash
npm run cap:sync
```

### Build Android debug APK on Windows

```bash
npm run apk:debug
```

For macOS or Linux, use the synced Android project and run `./gradlew assembleDebug` from `android/`.

## Offline and PWA Notes

- The app is local-first and does not require a backend.
- A service worker precaches the core app shell, modules, vendor libraries, and app icons.
- All business data is stored on-device.
- The Capacitor app now uses the local bundled `www/` assets instead of a remote server URL.

## Data Storage

### Main app data

- Storage key: `taxiFareV2`
- Stored in `localStorage`
- Contains:
  - `meta`
  - `settings`
  - `trips`
  - `expenses`
  - `customers`
  - `invoices`

### Receipt images

- Stored separately in IndexedDB
- Database: `taxiFareAssets`
- Store: `receipts`
- Images are compressed before saving to reduce storage pressure

### Why receipts are not in `localStorage`

Receipt images are much larger than normal trip and expense records. Keeping them in IndexedDB makes the app more reliable and avoids breaking the main local data store.

## Migration Behavior

The app automatically migrates older data when possible.

### Supported legacy data

- old `taxiFareV1` local storage data
- old `taxiFare_dark` theme flag

### Migration result

- old trips and expenses are preserved
- old settings are mapped into the new settings structure
- customer and invoice collections start empty if they did not exist before
- migrated data is saved into the new `taxiFareV2` structure

## Backup and Restore

### Backup export

- Exports JSON
- Includes trips, expenses, customers, invoices, settings, and stored receipts
- Uses native save or share flows inside the Android APK when available

### Restore import

- Validates backup format before applying it
- Prevents invalid imports from crashing the app
- Can create a safety backup before overwrite
- Rebuilds receipt storage from the imported backup
- Uses a hidden file picker flow that works in browser and Capacitor packaging

## Invoice PDF Generation

PDF invoices are generated fully in-browser and work offline after the app shell is cached.

### Included invoice content

- brand header area
- invoice number
- issue date
- due date
- billed by section
- billed to section
- trip line items
- subtotal
- tips
- total
- payment terms
- notes
- footer

### PDF libraries

- `jspdf`
- `jspdf-autotable`

These were chosen because they are stable, browser-friendly, and practical for lightweight offline PDF generation.

### Native export behavior

- In the web browser, invoice PDFs, workbooks, and backups download normally.
- In the Android APK, the app uses Capacitor file saving and share-sheet flows so export buttons still work inside a WebView.

## External Libraries

- `chart.js` for dashboard charts
- `xlsx` for workbook export
- `jspdf` for PDF generation
- `jspdf-autotable` for invoice line-item tables
- Capacitor for Android packaging

All runtime libraries used by the app are copied into local `vendor/` assets during the build step.

## Limitations

- Customer-specific reports only include customer-linked trip income. Expenses are global operating costs and are not allocated per customer.
- Browser storage limits vary by device. Large numbers of high-resolution receipts may still hit quota limits, although the app compresses images before saving.
- There is no backend sync. Backups are the recovery path across devices.

## Recommended Workflow

1. Keep customer profiles up to date in the Customers tab.
2. Link trips to customers when logging them.
3. Export a backup regularly from Settings.
4. Use Reports for business review.
5. Use Invoices to generate monthly client billing PDFs.

## Changelog Summary

### Current upgrade

- Refactored the single-file MVP into a modular app structure
- Added migrations, customer management, invoice archiving, and PDF exports
- Added trip and expense editing plus safer deletes
- Added backup restore and reliable receipt handling
- Fixed settings behavior, currency formatting, and report date filtering
- Improved offline packaging, native export handling, and Capacitor sync behavior

## License

This project is intended as a practical business tool for taxi drivers and small transport operators.
