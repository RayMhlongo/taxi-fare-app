# Taxi Fare - Professional Driver Analytics App

A comprehensive solution for South African taxi drivers to manage trips, track expenses, and analyze profitability in real-time.

## Features

### 📊 Dashboard
- **Daily Overview**: Today's trip count, total income, expenses, and net profit
- **Monthly Summary**: Visual overview of financial performance with gradient cards
- **7-Day Income Trend**: Chart visualization of earnings over the past week

### 🚗 Trip Management
Log detailed trip information:
- Date and time of trip
- Pickup and dropoff locations
- Distance traveled (km)
- Trip duration (minutes)
- Fare charged
- Tips received
- Payment method (cash, card, mobile, other)
- Passenger name
- Additional notes

### 💰 Expense Tracking
Track operational expenses across 8 categories:
- **Fuel**: Petrol/diesel costs
- **Maintenance**: Vehicle repairs and servicing
- **Toll**: Road toll fees
- **Parking**: Parking charges
- **Cleaning**: Vehicle cleaning costs
- **Insurance**: Insurance premiums
- **Registration**: Vehicle registration and licensing
- **Other**: Miscellaneous expenses

Each expense includes:
- Amount and quantity
- Description
- Receipt attachment option
- Date logged

### 📈 Advanced Reports
Generate comprehensive reports with:
- Custom date range selection
- Trip analytics (count, average fare, total distance, total hours)
- Financial summary (income, expenses, net profit)
- Data filtering and sorting

### 💾 Data Export
- **CSV Export**: Export all trip and expense data to CSV format
- **JSON Backup**: Backup all data as JSON for import/restore
- Compatible with Excel, Google Sheets, and other spreadsheet applications

### ⚙️ Settings
- **Driver Profile**: Name, vehicle plate number, contact information
- **Preferences**: Dark mode toggle, preferred currency selection
- **Data Management**: Backup, restore, and clear data options

### 🌓 Dark Mode
Professional dark theme with:
- Teal/green primary color scheme (#00bfa5)
- Optimized contrast ratios for readability
- Automatic system preference detection

### 📱 Offline Support
- Works completely offline with Service Worker
- All data stored locally via localStorage
- Automatic synchronization when online
- No internet required to log trips or expenses

## Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Framework**: Capacitor 7.4.3 (Web to Android bridge)
- **Charts**: Chart.js 4.4.0
- **Data**: localStorage with JSON serialization
- **Build**: GitHub Actions with Gradle
- **Platform**: Android APK via Capacitor

## Installation

### From Source
```bash
# Clone the repository
git clone https://github.com/RayMhlongo/taxi-fare-app.git
cd taxi-fare-app

# Install dependencies
npm install

# Run locally (web)
npm start

# Build for Android
npx capacitor add android
npx capacitor sync android
cd android
./gradlew assembleRelease
```

### From GitHub Releases
1. Go to [GitHub Releases](https://github.com/RayMhlongo/taxi-fare-app/releases)
2. Download the latest `app-release-unsigned.apk`
3. Transfer to Android device
4. Install APK (may need to enable "Unknown Sources" in settings)

## Usage

### Logging a Trip
1. Go to **Trips** tab
2. Click **Log New Trip**
3. Fill in all trip details:
   - Date and time
   - Locations
   - Distance and duration
   - Fare and tips
   - Payment method
   - Passenger info
4. Click **Save Trip**

### Tracking Expenses
1. Go to **Expenses** tab
2. Click **Add Expense**
3. Select expense category
4. Enter amount, description
5. Optionally upload receipt
6. Click **Save Expense**

### Generating Reports
1. Go to **Reports** tab
2. Select date range using "From" and "To" date pickers
3. View analytics:
   - Trip count and average fare
   - Total distance and time
   - Income/expense summary
   - Net profit calculation

### Exporting Data
1. Go to **Reports** tab
2. Click **Export to CSV**
3. Save file to device
4. Open in Excel or Google Sheets

### Settings
1. Go to **Settings** tab
2. Update driver profile information
3. Toggle dark mode
4. Select preferred currency
5. Backup or clear data as needed

## Metrics & Analytics

The app calculates key performance indicators for data-informed decision making:

- **Trip Metrics**: Count, average fare, per-km income, per-hour income
- **Distance Tracking**: Total km, distance distribution
- **Time Analysis**: Total hours, average trip duration
- **Financial Metrics**: Gross income, total expenses, net profit, profit margin
- **Payment Methods**: Track which payment methods generate most income
- **Expense Categories**: Identify highest expense categories by amount
- **Trend Analysis**: 7-day income chart for performance visualization
- **Period Comparison**: Compare metrics across date ranges

## Data Storage

All data is stored locally on your device in the browser database:
- **Storage Key**: `taxiFareV1`
- **Data Types**: Trips, Expenses, Settings
- **Backup Format**: JSON
- **Export Format**: CSV

### Backup & Restore
- Use **Settings → Backup Data** to download JSON backup
- Use **Settings → Restore Data** to import from JSON
- JSON backups are compatible with other devices

## Privacy & Security

- ✅ All data stored locally on your device
- ✅ No data sent to external servers
- ✅ No registration or login required
- ✅ Full data ownership and control
- ✅ Easy data export and backup

## Browser Compatibility

- ✅ Chrome/Chromium (recommended)
- ✅ Firefox
- ✅ Safari (iOS)
- ✅ Samsung Internet
- ✅ All Chromium-based browsers

## Development

### Local Development Server
```bash
npm install
# Serve on http://localhost:8000
python -m http.server 8000
```

### Building for Production
```bash
npm install
npx capacitor sync
cd android
./gradlew assembleRelease
```

### GitHub Actions CI/CD
The app automatically builds an APK on every push to `main` or `master` branch. View build status in [Actions](https://github.com/RayMhlongo/taxi-fare-app/actions).

## Troubleshooting

### APK Installation Issues
- Enable "Unknown Sources" in Android Settings → Security
- Ensure sufficient storage space (50MB+)
- Try clearing Play Store cache if previously installed

### Data Not Saving
- Check browser storage permissions
- Clear browser cache and cookies
- Try a different browser
- Create manual backup before clearing data

### Offline Mode Not Working
- Ensure Service Worker is installed (requires HTTPS on production)
- Check browser settings for Service Worker permissions
- Try reload after first visit

## Support & Feedback

- 📧 Email: rodgersmhlongo23@gmail.com
- 🐛 Report issues: [GitHub Issues](https://github.com/RayMhlongo/taxi-fare-app/issues)
- 💡 Suggestions: Open a discussion or issue

## License

This project is designed for South African taxi drivers. Use it freely to manage your operations.

## Version History

### v1.0.0 - Initial Release
- Complete trip logging system
- Expense tracking across 8 categories
- Advanced reporting and analytics
- CSV export functionality
- Dark mode support
- Offline-first architecture
- GitHub Actions automated builds

---

**Last Updated**: January 2025
**Status**: Active Development
**Target Platforms**: Android 8.0+ (API 26+), Web Browsers
