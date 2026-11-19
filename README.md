# Ovrto

Over to you. Every task shows whose turn it is. Live at https://fatmasalah-tam.github.io/SSS-tasks/

## How it is made

A plain web app: HTML, CSS and JavaScript, no framework. The data, sign-in, files and permissions live in Supabase (PostgreSQL). GitHub Pages serves `index.html`.

## Where the code is

`index.html` is **built**. Do not edit it by hand. Edit `src/`, then build.

```
src/index.html      the page, with two markers where the styles and the script go
src/css/app.css     all styles
src/js/NN-name.js   the app script, one file per feature, joined in number order
build.py            joins src/ into index.html (Python standard library only)
sw.js, manifest.json, icon-*.png   installable phone app and push alerts
home.html           the public website
```

All files in `src/js/` run together in one scope, so a function written in one file can be used from any other. The number sets the order they load in; shared code (`01-core`, `02-ui-primitives`) comes first.

| File | What is in it |
|---|---|
| 01-core | config, state `S`, helpers, data loading, the offline outbox |
| 02-ui-primitives | `h()` (element builder), toasts, popovers, sheets |
| 03-views, 04-shell | filters and grouping; navigation, task cards, My turn, Review, Inbox |
| 05-task-detail, 06-create | the task page; the New task sheet |
| 07-settings | all of Settings |
| 14-auth-screens, 15-boot | sign-in screens; start-up |
| 16-bulk-import | Excel / CSV / Linear import |
| 17-chat | channels, DMs, threads, huddles |
| 19-ai-franco-voice | Franco / Arabic / voice to task |
| 21-client-pages-projects-bugs | client status page, projects, docs, bugs |
| 24-money, 25-company | project money, CEO Company page |
| 26-departments, 29-job-home-pages | the 22 department homes |
| 30-deals, 31-agents | deals; department AI agents |
| 32-access, 33-leave-and-cover | shared logins vault; leave and cover |
| 38-arabic-dictionary | the English to Arabic text list (one very long line) |

## Build

```
python3 build.py          # write index.html from src/
python3 build.py --check  # fail if index.html is out of date
```

Run `build.py` after every change and commit `src/` and `index.html` together.

## Database

Supabase project `epictdzctjgbsctobejh`. The app reads tables with `sb.from(...)`, calls functions with `sb.rpc(...)`, and uses the `notify` and `agents` edge functions for AI. Money, salaries and logins are protected by row-level security in the database, not only hidden on screen. The public key in `01-core.js` is the anon key and is meant to be public; the service-role key must never be committed.

## Moving to a framework later

The split above is the first step: each file is a feature, so features can move to React/TypeScript one at a time while the app keeps working. Suggested order: shared helpers (`01`, `02`), then self-contained pages (`20-insights`, `23-deploys`, `22-waiting-on-someone`), then bigger ones (`17-chat`, `04-shell`). Keep Supabase as it is.
