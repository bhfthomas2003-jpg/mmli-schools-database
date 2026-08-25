# MMLI School Database

An internal school information database for **Mind Masters Liberia Initiative (MMLI)** —
used to track schools for letter distribution, follow-ups, academic and sports
competitions, quizzes, and future MMLI programs.

Runs **100% on GitHub Pages**. No server, no database service, no accounts,
no API keys, no build tools. Plain HTML, CSS, and JavaScript only.

---

## How it works

- All school records are stored **in your browser** using **IndexedDB**, a
  storage system built into every modern browser (including Chrome on
  Android).
- There is no external database and no backend. The app is just static
  files served by GitHub Pages.
- Because data lives in the browser, it is **specific to one device and one
  browser app**. See the warning below.
- The app keeps working after it has loaded even if you lose signal, thanks
  to a small Service Worker that caches the core files.

## ⚠️ Important warning: where your data lives

Your school records are stored **only on the device and browser you used to
add them.** This means:

- Opening the site on a different phone, computer, or browser will show an
  **empty** database — it does not automatically sync.
- Clearing your browser's site data/history, uninstalling the browser, or
  resetting your phone can **permanently delete** your records.
- **Export a JSON backup regularly** (see below) and save a copy somewhere
  safe — email it to yourself, upload it to Google Drive, or send it to
  another MMLI staff member.

---

## Files in this project

```
MMLI-School-Database/
├── index.html          → App shell and layout (logo is built in — no upload needed)
├── style.css            → All styling (navy / gold / white / gray theme)
├── app.js                → App logic: navigation, forms, lists, profile view
├── database.js           → IndexedDB read/write logic
├── backup.js              → Export JSON/CSV, import/restore, clear data
├── manifest.json           → Lets you "install" the site like an app (logo built in)
├── service-worker.js        → Enables offline use after first load
├── README.md                → This file
└── assets/
    └── mmli-logo.png          → Optional spare copy of the logo — not required by the app
```

The MMLI logo is **embedded directly inside `index.html` and `manifest.json`**
as built-in image data, so it will always display correctly — even if you
skip uploading the `assets` folder entirely. The `assets/mmli-logo.png` file
is only included as a spare copy in case you want to reuse the logo
elsewhere; the app itself doesn't depend on it.

---

## Uploading to GitHub (from your phone)

1. Create a free GitHub account if you don't already have one, and create a
   **new repository** — for example `MMLI-School-Database`. Make it
   **Public** (GitHub Pages on a free account requires a public repo).
2. Inside the new repository, tap **Add file → Upload files**.
3. Upload every file listed above **keeping the same names**. For the logo,
   first create the `assets` folder by uploading `mmli-logo.png` and typing
   `assets/mmli-logo.png` as its path in GitHub's uploader (GitHub creates
   the folder for you).
4. Commit the files (tap **Commit changes**).

## Enabling GitHub Pages

1. In your repository, go to **Settings → Pages**.
2. Under "Build and deployment", set **Source** to **Deploy from a branch**.
3. Choose the **main** branch and the **/ (root)** folder, then **Save**.
4. GitHub will give you a URL that looks like:
   `https://YOUR-USERNAME.github.io/MMLI-School-Database/`
5. Open that link — the app should load. It can take a minute or two the
   first time.

---

## Using the app

### Adding a school
Tap **Add** in the bottom navigation, fill in the required fields (marked
with `*`), and tap **Add School**. If a school with a very similar name
already exists, you'll see a **possible duplicate** warning — review the
existing record, or continue if it's genuinely a different school.

### Editing / deleting
Open a school from the **Directory** or **Dashboard**, then tap **Edit** to
change any information, or **Delete** to remove it (you'll be asked to
confirm).

### Searching and filtering
On the **Directory** tab, use the search box to search by school name,
principal, coach/sports person, phone, email, or location. Use the filter
chips to narrow by school type, county, letter status, or follow-up status.

### Phone and email links
On a school's profile, tap a phone number to call it, or an email address
to open your mail app — these use standard `tel:` and `mailto:` links.

### Dashboard
The **Dashboard** tab shows live counts: total schools, JHS/SHS split,
letters delivered/not delivered, and follow-up status breakdown. These
update automatically as you add, edit, or delete schools.

---

## Backing up your data

Go to the **Backup** tab (or **Settings**):

- **Export JSON Backup** — downloads a `.json` file containing every school
  record. This is the file you should keep safe and use to restore data.
- **Export CSV** — downloads a spreadsheet-friendly `.csv` file you can open
  in Excel, Google Sheets, or similar.

Save these files somewhere outside the browser — email them to yourself,
upload to Google Drive, or share to WhatsApp/Telegram "Saved Messages."

## Restoring a backup

1. Go to **Backup** (or **Settings**) → **Import Backup**.
2. Select a previously exported `.json` file.
3. Choose how to apply it:
   - **Add to Existing Data** — keeps everything currently in the database
     and adds the records from the backup file alongside it.
   - **Replace Existing Data** — permanently deletes everything currently
     in the database first, then restores from the backup file.
4. You'll be asked to confirm before anything is deleted or changed.

## Clearing all data

In **Settings → Clear All Data**, you must type
`DELETE ALL SCHOOL DATA` exactly before the delete button is enabled. This
is intentional — it prevents accidental data loss. Export a backup first if
there's any chance you'll need the data again.

---

## Optional local access screen

In **Settings**, you can turn on a **Local Access Screen** with a code you
choose. This simply hides the app behind a prompt on this device — it is a
**convenience feature only**, clearly **not real security**. GitHub Pages
cannot provide secure backend authentication, and anyone with access to the
device's browser tools can bypass this screen. Do not rely on it to protect
sensitive information.

---

## Offline use

After you've opened the app once while online, a Service Worker caches the
core app files. You can keep using the app to view, add, edit, and search
schools even without an internet connection — your data is already stored
locally in IndexedDB. You'll see an **Offline** indicator in the header when
there's no connection.

---

## Troubleshooting

- **Blank page after enabling Pages:** wait a minute and refresh — the first
  deployment can take a little time.
- **Logo doesn't show:** this shouldn't happen anymore — the logo is baked
  directly into `index.html` and `manifest.json`, so it displays even without
  the `assets` folder. If you edited those two files, double-check you didn't
  accidentally delete the `data:image/png;base64,...` text inside the `<img>`
  tags or the manifest's `icons` section.
- **My schools disappeared:** you're likely on a different browser/device,
  or the browser's site data was cleared. Restore from your latest JSON
  backup.
- **Import says "not a valid backup":** make sure you're selecting a `.json`
  file that was exported from this app, not a CSV or another file type.
