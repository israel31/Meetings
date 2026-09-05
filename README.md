# Meetings — Event Attendance

Web app to create events, load attendee rosters from spreadsheets, take attendance, end events, and export reports.

## Features

- **Create events** with title, date, location, and notes
- **Import roster** per event via:
  - File upload (`.csv`, `.xlsx`, `.xls`)
  - Spreadsheet link (Google Sheets share link or direct CSV URL)
- Auto-detects **Name**, **Email**, and **ID** columns
- Mark present/absent, search & filter, mark all
- **End Event** workflow with timestamp and lock/reopen options
- **Export Attendance** in CSV and Excel (`.xlsx`) formats (All, Present, Absent)
- Data saved in the browser (`localStorage`)

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Deploying to GitHub Pages

### Option 1: GitHub Actions (Automated & Recommended)
1. Push your code to a GitHub repository.
2. In your repository on GitHub, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Create a file `.github/workflows/deploy.yml` in your project with the GitHub Actions deployment workflow.

### Option 2: Using `gh-pages` CLI
```bash
npm install --save-dev gh-pages
```
Add to `package.json` scripts:
```json
"predeploy": "npm run build",
"deploy": "gh-pages -d dist"
```
Then run:
```bash
npm run deploy
```

## Google Sheets

1. Share the sheet as **Anyone with the link** (Viewer)
2. Paste the sheet URL when creating an event
3. Meetings converts it to the export endpoint automatically

## Spreadsheet columns

Headers can be flexible, for example:

| ID | Name | Email |
|----|------|-------|
| A001 | Ada Lovelace | ada@example.com |

Also recognized: `Student ID`, `Full Name`, `E-mail`, etc.
