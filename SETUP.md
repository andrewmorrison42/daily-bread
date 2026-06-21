# Daily Bread — setup guide

This is a self-contained app. Once it's on a web address and you've added it to
your home screen, it runs entirely on your phone: your reading progress, prayer
list, and journal are stored on the device. No account, no Claude, no internet
needed after the first load.

You and Greta each install it on your own phone. Your data is separate and
private to each device — nothing is shared or synced between you.

---

## What's in this folder

- `index.html` — the app page
- `app.js` — the app itself
- `manifest.json` — makes it installable
- `sw.js` — lets it work offline
- `icon-180.png`, `icon-192.png`, `icon-512.png` — the home-screen icon

All seven files must sit together in the same place.

---

## Step 1 — Put the files online (free, ~10 minutes)

The app needs to live at a web address (https). The simplest free option is
**GitHub Pages**. You don't need to know how to code.

1. Make a free account at github.com.
2. Click the **+** (top right) → **New repository**.
3. Name it something like `daily-bread`. Set it to **Public**. Click
   **Create repository**.
4. On the new repo page, click **uploading an existing file**.
5. Drag in all seven files from this folder. Click **Commit changes**.
6. Go to **Settings** (top of the repo) → **Pages** (left sidebar).
7. Under **Branch**, choose **main**, folder **/ (root)**, click **Save**.
8. Wait a minute, then refresh. GitHub shows a green link like
   `https://yourname.github.io/daily-bread/`. That's your app's address.

Send that link to your phone (and to Greta).

> Alternative: Netlify Drop (app.netlify.com/drop) — drag the folder onto the
> page and it gives you a link instantly, no account needed for a basic site.
> GitHub Pages is steadier for the long term; Netlify Drop is faster to try.

---

## Step 2 — Install it on your phone

**iPhone (Safari — must be Safari, not Chrome):**
1. Open the link in Safari.
2. Tap the **Share** button (square with an up-arrow).
3. Scroll down, tap **Add to Home Screen**, then **Add**.
4. Launch it from the new icon. It opens full-screen like a normal app.

**Android (Chrome):**
1. Open the link in Chrome.
2. Tap the **⋮** menu (top right).
3. Tap **Add to Home screen** (or **Install app**), then confirm.
4. Launch it from the new icon.

After this first load, the app works with no internet.

---

## Step 3 — Back up your data (important)

Your entries live on your phone only. If you clear the browser's site data,
delete the app, or switch phones, the entries go with it **unless you've
exported a backup**.

In the app, go to the **Journal** tab → **Export & backup**:

- **Journal (Markdown)** — a readable copy of your reflections.
- **Full backup (JSON)** — everything (reading progress, prayers, journal).
  Keep these somewhere safe (email it to yourself, save to cloud storage).
- **Restore backup** — load a JSON backup back in, e.g. on a new phone.

Do a JSON export every week or two. It's the only thing that makes you
recoverable if something happens to the phone.

---

## Updating the app later

If you ever want changes, replace `app.js` (and any other changed file) in the
same GitHub repo: open the file there, click the pencil/upload, commit. The app
updates next time it's opened with internet. Your saved data is untouched by
updates — it lives separately in the phone's storage.

---

## The "prime your reading" questions

This version generates reading questions from a built-in set written in the
Reformed reading tradition (God's initiative, covenant, law and gospel, Christ
throughout Scripture, and so on). They're general questions to carry into any
chapter, chosen at random — they don't require any internet or AI service, so
they work everywhere, forever. They are questions only and never quote any
source.
