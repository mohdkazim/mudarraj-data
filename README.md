# mudarraj-data

Daily football data for **مدرج الجمهور — Mudarraj Al Jumhoor**, a bilingual (Arabic/English) results and fixtures site running on a Synology NAS.

- **What's here:** fixtures, results and the structure behind the tables for the 2026–27 season. Competitions: ADNOC Pro League, UAE President's Cup, ADIB Cup, EMAAR Super Cup, Premier League, LALIGA, UEFA Champions League, AFC Champions League Elite and Two, Gulf Club Champions League, AFC Asian Cup 2027.
- **Who updates it:** scheduled Claude runs — the full update every morning at 05:36 UAE time, and a results-only check every hour on match evenings (16:35–02:35 UAE) — following [`RUNBOOK.md`](RUNBOOK.md) and reading only the sites in [`SOURCES.md`](SOURCES.md).
- **How it stays accurate:**
  - every result carries the URLs it was confirmed on: one official source, or two independent reputable ones
  - `tools/apply.mjs` rejects anything less
  - `tools/build.mjs` refuses to publish if the data is inconsistent, or if our results don't add up to the official league tables
  - every run is logged in [`CHANGELOG.md`](CHANGELOG.md)
- **What the website reads:** [`dist/football.json`](dist/football.json) only.

## Spotted a mistake?

Tell Claude in the project chat ("Al Ain v Ajman on 29 Oct ended 2-1, not 1-1"). It records a `correction` with sources. Or open an issue here.

## Layout

| Path | What it is |
|---|---|
| `data/teams.json` | Clubs and national teams with English and Arabic names, and each club's home stadium (used for its home matches unless a match lists its own venue) |
| `data/competitions.json` | Current season and structure of each competition (tables, groups, rounds) |
| `data/seasons/<competition>/<season>.json` | Matches |
| `data/checks/` | Reference tables copied from trusted sites; the build compares our results against them |
| `data/pending.json` | Claims seen on only one source, waiting for a second |
| `patches/` | Each run's changes, with sources |
| `tools/` | `status`, `apply`, `validate`, `build` (plain Node, no dependencies) |

```bash
node tools/status.mjs      # what needs checking
node tools/apply.mjs patches/<date>.json
node tools/build.mjs       # validates, then writes dist/football.json
```
