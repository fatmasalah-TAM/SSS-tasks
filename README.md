# Ovrto

Over to you. Every task shows whose turn it is. Live at https://fatmasalah-tam.github.io/SSS-tasks/

## How it is made

A web app moving from plain JavaScript to React + TypeScript, one page at a time. The data, sign-in, files and permissions live in Supabase (PostgreSQL). GitHub Pages serves `index.html`.

## Where the code is

`index.html` and `react-app.js` are **built**. Do not edit them by hand. Edit `src/`, then build.

```
src/index.html      the page, with markers where the start-up script, styles and app script go
src/boot.js         tiny script in the head (theme and language before first paint)
src/css/app.css     all styles
src/js/NN-name.js   the old app (plain JavaScript), one file per feature, joined in number order
src/react/          the pages already moved to React + TypeScript
build.py            builds index.html and react-app.js (needs Python 3 and esbuild)
sw.js, manifest.json, icon-*.png   installable phone app and push alerts
home.html           the public website
```

The old app and the React pages run side by side. The old code draws the shell (sidebar, tabs, sheets) and calls React to draw each moved page: `reactView('insights')` in `src/js/` hands the page to `src/react/main.tsx`. React reads the app's state and calls its actions through `window.__ovrto` (listed in `src/js/37-react-bridge.js`, typed in `src/react/types.ts`). A piece that is not in React yet is drawn by the old code inside the React page with `<LegacyNode>`.

All files in `src/js/` run together in one scope, so a function written in one file can be used from any other.

## Moving a page to React

1. Write the page in `src/react/pages/` and list it in `VIEWS` in `src/react/main.tsx`.
2. In the old view function, return `reactView('name')`. Delete the old code the page no longer needs (keep what other pages still use).
3. Build, then compare the old and new page on phone and laptop, light and dark, English and Arabic. The first move (Insights) matched the old page pixel for pixel in all 8 views.

| Page | State |
|---|---|
| Insights | React |
| Owner dashboard, Review, Inbox, My turn | old |
| Projects and one project, Company, Deals, Department homes, Access (vault) | old |
| Work / Bugs / Sprint (board, list), task detail, New task | old |
| Chat, Settings, Import, Weekly report, Leave | old |
| Shell (sidebar, tabs), state and data loading | old (last to move) |

## Build

```
npm install               # once: React, TypeScript, esbuild
python3 build.py          # write index.html and react-app.js from src/
python3 build.py --check  # fail if they are out of date
npm run typecheck         # check the TypeScript
```

Run `build.py` after every change and commit `src/`, `index.html` and `react-app.js` together. The build also stamps a build number (phones reload when it changes) and the Content-Security-Policy hashes of the inline scripts.

## Database

Supabase project `epictdzctjgbsctobejh`. The app reads tables with `sb.from(...)`, calls functions with `sb.rpc(...)`, and uses the `notify` and `agents` edge functions for AI. Money, salaries and logins are protected by row-level security in the database, not only hidden on screen. The public key in `01-core.js` is the anon key and is meant to be public; the service-role key must never be committed.
