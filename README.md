# InsightRide

InsightRide is a mobile-first, offline-first taxi driver operations app for South African drivers, built and branded by Data Insights by Ray.

This version keeps the existing local-first product workflow and adds practical commercial protection:

- monthly subscription verification
- demo mode limits and expiry
- read-only lockout after expiry
- install-aware licensing
- premium feature gating
- stronger ownership branding inside the app

## Core Product Features

- trip logging with payment-method tracking
- expense tracking with offline receipt storage
- customer management for regular and monthly clients
- customer-linked trips
- invoice PDF generation with two layouts
- dashboard metrics and daily cash-up view
- workbook export
- JSON backup and restore
- offline-first PWA behavior
- Capacitor Android packaging

## New Commercial Protection Layer

### What was added

- Central business config in [`js/config.js`](./js/config.js)
- Demo/review mode rules in [`js/demo.js`](./js/demo.js)
- Subscription and device-aware verification in [`js/license.js`](./js/license.js)
- Shared feature-gating and read-only enforcement in [`js/protection.js`](./js/protection.js)
- Protected storage metadata and migration updates in [`js/storage.js`](./js/storage.js)
- Visible subscription state, ownership labels, and install ID tools in Settings and the main app shell

### Paid subscription behavior

- Each paid driver is expected to have one issued `license_id`
- A subscription stays valid until `paid_until`
- A grace period stays valid until `grace_until`
- The frontend also supports a default 2-day grace calculation when `grace_until` is not explicitly stored
- Verification is cached locally for short offline periods
- If verification is overdue or the subscription is expired, the app switches to read-only mode

### Restricted read-only mode

When the subscription is expired, suspended, missing, unverified for too long, or backend verification is unavailable in production, the app still opens but:

- trips can be viewed but not added, edited, or deleted
- expenses can be viewed but not added, edited, or deleted
- settings can be viewed
- dashboard can be viewed
- exports are disabled
- backup and restore are disabled
- invoice save/share/download are disabled
- clear-data is disabled

### Demo mode

Demo mode is controlled from [`js/config.js`](./js/config.js).

Default demo rules:

- maximum 30 trips
- maximum 20 expenses
- maximum 3 customers
- clear “Demo Version” labeling
- “Property of Data Insights by Ray” ownership treatment
- no workbook export
- no backup or restore
- no invoice PDF tools
- automatic read-only mode after demo expiry

## Config

Business protection is controlled in [`js/config.js`](./js/config.js).

Important keys:

- `DEMO_MODE`
- `DEMO_MAX_TRIPS`
- `DEMO_MAX_EXPENSES`
- `DEMO_MAX_CUSTOMERS`
- `DEMO_EXPIRES_DAYS`
- `SUBSCRIPTION_ENABLED`
- `SUBSCRIPTION_GRACE_DAYS`
- `MAX_OFFLINE_VERIFICATION_DAYS`
- `LICENSE_CHECK_INTERVAL_HOURS`
- `APP_BRAND_NAME`
- `APP_OWNER_NAME`
- `SUPPORT_CONTACT`
- `ENABLE_EXPORTS`
- `ENABLE_INVOICES`
- `ENABLE_BACKUP_RESTORE`
- `ENABLE_ADVANCED_REPORTS`
- `DEVICE_BINDING_MODE`
- `DEVELOPER_PREVIEW_ON_LOCALHOST`
- `LICENSE_BACKEND.url`
- `LICENSE_BACKEND.anonKey`
- `LICENSE_BACKEND.functionName`

### Recommended production config flow

1. Keep `SUBSCRIPTION_ENABLED: true`
2. Keep `DEMO_MODE: false` for paid builds
3. Set the real Supabase project URL and anon key
4. Deploy the `verify-license` Supabase Edge Function
5. Issue a `license_id` per paying driver

### Local developer preview behavior

To avoid blocking normal development, this app allows a visible local preview bypass on `localhost` or `file:` when the backend is not configured and `DEVELOPER_PREVIEW_ON_LOCALHOST` is enabled.

That bypass is only for local development. In production hosting, an unconfigured license backend forces restricted mode.

## Supabase Subscription Backend

This repo now includes a lightweight Supabase scaffold for license verification.

Files:

- [`supabase/migrations/20260324_create_license_tables.sql`](./supabase/migrations/20260324_create_license_tables.sql)
- [`supabase/functions/verify-license/index.ts`](./supabase/functions/verify-license/index.ts)

### Why Supabase

Supabase is a practical fit for a small commercial app because it gives you:

- a hosted Postgres table for driver licenses
- an Edge Function for server-side verification
- an easy admin interface for updating payment status
- a simple path to future auth or admin dashboards if needed

### Tables

#### `driver_licenses`

Suggested fields:

- `license_id`
- `driver_name`
- `business_name`
- `status`
- `paid_until`
- `grace_until`
- `bound_install_id`
- `device_fingerprint`
- `notes`
- `last_verified_at`

#### `license_verification_log`

Suggested fields:

- verification log id
- `license_id`
- `install_id`
- `device_fingerprint`
- `result_status`
- `verified_at`
- `notes`

### Edge function behavior

The included `verify-license` function:

- receives `licenseId`, `installId`, and `deviceFingerprint`
- looks up the matching license row
- derives `active`, `grace`, `expired`, or `suspended`
- binds the install on first successful verification
- can soft-enforce one-license-per-device by suspending mismatched installs
- logs verification attempts
- returns a minimal response for the frontend to cache locally

### Supabase setup steps

1. Create a Supabase project
2. Run the SQL in [`supabase/migrations/20260324_create_license_tables.sql`](./supabase/migrations/20260324_create_license_tables.sql)
3. Deploy the Edge Function in [`supabase/functions/verify-license/index.ts`](./supabase/functions/verify-license/index.ts)
4. Set Edge Function secrets:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - optional `SUBSCRIPTION_GRACE_DAYS`
5. Copy the project URL and anon key into [`js/config.js`](./js/config.js)
6. Add one row per customer into `driver_licenses`

### How to update a driver’s paid status

The simplest admin workflow is:

1. Open the `driver_licenses` table in Supabase
2. Find the driver’s `license_id`
3. Set `paid_until` to the paid month end date
4. Optionally set `grace_until`
5. Keep `status` as `active` unless you intentionally want to suspend access

Examples:

- paid for March 2026: `paid_until = 2026-03-31`
- default grace: leave `grace_until` blank and let the server calculate 2 extra days
- manual hold: set `status = suspended`

## Data Model

Main app data is still stored locally, but the model now includes protected metadata.

Stored in local storage key `taxiFareV2`:

- `meta`
- `appMeta`
- `installMeta`
- `licenseMeta`
- `settings`
- `trips`
- `expenses`
- `customers`
- `invoices`

Receipt images remain in IndexedDB:

- database: `taxiFareAssets`
- store: `receipts`

### Important protection rule

Backups do **not** carry install identity or license verification state.

That is intentional. It reduces abuse from users moving a “paid” state between devices by sharing backup files.

## Project Structure

```text
index.html
styles.css
manifest.json
service-worker.js
js/
  config.js
  app.js
  storage.js
  utils.js
  demo.js
  license.js
  protection.js
  trips.js
  expenses.js
  customers.js
  reports.js
  settings.js
  invoices.js
scripts/
  build.mjs
supabase/
  migrations/
  functions/
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

### Preview locally

```bash
python -m http.server 8000
```

Open:

```text
http://localhost:8000
```

### Run browser tests

```bash
npm run test:e2e
```

### Sync to Capacitor Android

```bash
npm run cap:sync
```

### Build Android debug APK on Windows

```bash
npm run apk:debug
```

## PWA and Offline Notes

- The app stays local-first for daily usage
- The service worker now precaches the new protection modules too
- License status is cached locally after successful verification
- Offline tolerance is limited by config
- Once offline verification is too old, write features lock until the device reconnects

## Existing Product Improvements Kept

The following existing strengths remain in place:

- modular JS structure instead of a giant single file
- reliable currency formatting
- real Date-based report filtering
- customer-linked invoicing
- receipt image storage
- mobile-first layout
- working dark mode
- backup restore and safety backup flow
- polished invoice PDF output

## Changelog

### Current upgrade

- Added config-driven commercial protection
- Added demo limits and demo expiry handling
- Added subscription verification, install ID, and device-aware binding support
- Added shared feature gating for write actions, exports, backups, and invoice PDFs
- Added visible ownership branding and status banners
- Protected backup and reset flows from carrying or clearing license state
- Added Supabase migration and edge function scaffold
- Updated service worker caching for the new modules

## Notes for Paid Deployment

- Do not ship a production build with an empty `LICENSE_BACKEND`
- Issue one `license_id` per customer
- Treat backup files as data recovery only, not as license transfer tools
- If a driver changes devices, clear or update `bound_install_id` in Supabase for that license before reactivating it
