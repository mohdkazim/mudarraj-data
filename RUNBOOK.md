# Daily data run — runbook

Two scheduled Claude runs keep the data up to date (a person can follow this too):

- **Morning run, 05:36 UAE — the full update** (the Steps below): results, fixtures, kick-off times, second sources, Monday table checks.
- **Evening results runs, hourly 16:35–02:35 UAE — results only** (see "Evening results run" further down): adds the results of matches that finished in the last few hours, so the site shows them about an hour after full time.

Late European kick-offs end by about 02:00 UAE time, so by the morning run every result from the day before should be published somewhere.

## Ground rules

1. **Never from memory.** Every score, date or kick-off time must come from a page read during this run, and its URL goes in `sources`.
2. **Use `SOURCES.md`.** A result needs one Tier 1 site, or two different Tier 2 sites, or one Tier 2 plus one Tier 3. The tools enforce this and reject anything less.
3. **When in doubt, leave it out.** Put a single-source claim under `unconfirmed`, and the next run re-checks it. A day-old gap is better than a wrong score.
4. **Times are stored in UTC** (ISO, e.g. `2026-10-29T14:10:00Z`). Dates in file names and logs are UAE dates.
5. **Never hand-edit `data/`.** All changes go through a patch, `tools/apply.mjs` and `tools/build.mjs`. The one exception is fixing the structure in `data/competitions.json` (groups, rounds) when an organiser changes a format; say so in the commit message.
6. **Never push a failing dataset.** If `tools/build.mjs` fails, fix the cause or drop the change.
7. **Goal scorers: all or none.** List a match's goals only when a source gives every goal (scorer and minute). A partial list misleads; leave `goals` out instead.
8. **Stay inside this repository.** Don't change anything else, and don't work around a site that refuses the automated reader (BBC, The Guardian): use another source from `SOURCES.md`.
9. **Be efficient.** Fetch the pages listed in `SOURCES.md` directly; use web search only to find a specific match page or report. One results page usually covers a whole round.

## Steps

```bash
# 0. Get the repository (scheduled runs: attach mohdkazim/mudarraj-data with push access first)
git clone https://github.com/mohdkazim/mudarraj-data.git && cd mudarraj-data   # or: git pull

# 1. What needs doing today
node tools/status.mjs
```

2. **Gather facts** for everything listed:
   - **NEEDS A RESULT:** look the match up on the competition's sources and confirm the score (see the rule above). Record half-time if a source shows it. For extra time or penalties, record `regular`, `et` and `pens`.
   - **KICK-OFF TIME NOT CONFIRMED:** look for the time on a Tier 1 or 2 site.
   - **WAITING FOR A SECOND SOURCE:** try to confirm or correct each claim.
   - **FIXTURE LISTS:** when a list ends inside the window, or a draw or schedule announcement happened, add the new fixtures. Fill knockout placeholders once the teams are known: use a `fixture` op with the existing match id plus `home`/`away`.
   - **Postponed, cancelled or abandoned** matches: use a `status` op (Tier 1 or 2 source).
   - **POSTPONED OR ABANDONED** (listed by `status.mjs`): look for the new date or the organiser's decision. New date → `fixture` op with the existing `match` id and the new `kickoff` (the match goes back to "not started"). Result awarded or the match resumed and finished → `result` op.
   - **Mondays:** add a `table-check` for each league table (EPL from Sky Sports, LALIGA from laliga.com, others when a Tier 1 or 2 table is readable). Copy `played` and `points` for every team and set `asOf` to when that table was last updated. The build then fails if our results don't add up to the same table. That's how missing or wrong results are caught.

3. **Write the patch** `patches/<UAE date>.json`. The format is documented at the top of `tools/apply.mjs`. Stage keys and table ids are in `data/competitions.json`, team ids in `data/teams.json`. A club that isn't listed needs a `team` op first, with its English and Arabic names from a Tier 1 or 2 source (Arabic news sites and official Arabic pages are best).

4. **Apply and build:**
   ```bash
   node tools/apply.mjs patches/<date>.json
   node tools/build.mjs
   ```
   Rejected changes are listed with the reason. Fix and re-apply them in a second patch (`patches/<date>-b.json`) if there's a better source, or leave them under `unconfirmed`.

5. **Publish:**
   ```bash
   git add -A && git commit -m "data: <date> — <n> results, <m> fixtures" && git push
   ```

6. **Report** in a few lines:
   - what changed: results and fixtures added or moved
   - what is still waiting for a second source
   - anything that failed: unreadable sources, rejected changes

## Evening results run (hourly, 16:35–02:35 UAE)

A small run with one job: results of matches that have just finished. Everything else waits for the morning run.

1. Get the repository as in step 0, then:
   ```bash
   node tools/status.mjs --results
   ```
   It lists matches that kicked off in the last 12 hours, should have finished (kick-off at least 2.5 hours ago) and still have no result, plus second-source claims about them.
2. **"NOTHING TO DO" → stop.** No web lookups, no commit, no report. Most runs end here.
3. Otherwise confirm each listed result exactly as in step 2 above (same sources, same rules: one Tier 1, or two different Tier 2, or Tier 2 + Tier 3; single-source claims go under `unconfirmed`). A match that is still going (extra time, a late kick-off, a delay) or has no confirmed result yet is simply left for the next run.
4. Write `patches/<UAE date>-<HHMM>.json` (e.g. `patches/2026-10-24-2135.json`, so runs never overwrite each other or the morning patch), then `node tools/apply.mjs` and `node tools/build.mjs` as in step 4.
5. Publish only if the build passes: `git commit -m "data: <UAE date> <HH:MM> — <n> results"` and push. Push rejected → `git pull --rebase`, build again, push.
6. **No report when things went normally** — the morning run reports the day. Only report a problem that stopped publishing (no GitHub access, a build you couldn't fix, a push that kept failing).

Don't do in an evening run: fixture lists, kick-off times, postponed matches, table checks, older gaps from previous days. Those are the morning run's.

## When something goes wrong

| What happens | What to do |
|---|---|
| A source is down or unreadable | Use the next source in `SOURCES.md` for that competition; if none confirms, leave the match for tomorrow |
| Two trusted sources disagree on a score | Prefer Tier 1. Two Tier 2 sites disagreeing with no Tier 1: record nothing, list it under `unconfirmed` with both URLs, mention it in the report |
| A published score turns out wrong | `correction` op with the reason and the new sources; never edit `data/` by hand |
| `tools/build.mjs` fails on a `table-check` | Our results don't match the official table: find the missing or wrong result for that team (compare played and points) before publishing anything |
| `git push` is rejected | `git pull --rebase`, re-run `node tools/build.mjs`, push again; if it still fails, stop and report |
| Nothing to do today | Don't commit; just report "no changes" |

## Stage keys (from `data/competitions.json`)

| Competition | League / group stage | Knockout rounds |
|---|---|---|
| `epl`, `laliga`, `uae-pro-league` | `{"key":"regular","type":"league","round":N}` | — |
| `ucl` | `{"key":"league-phase","type":"league-phase","round":MD}` | `playoff`, `r16`, `qf`, `sf`, `final` |
| `acle` | `{"key":"league-west","type":"league-phase","group":"west","round":MD}` (East: `league-east`, `"group":"east"`) | `r16-west`, `r16-east`, `qf`, `sf`, `final` |
| `acl2` | `{"key":"groups","type":"group","group":"A","round":MD}` | `r16-west`, `r16-east`, `qf-west`, `qf-east`, `sf-west`, `sf-east`, `final` |
| `uae-league-cup` | see `data/competitions.json` (format can change between seasons) | `qf`, `sf`, `final` |
| `uae-presidents-cup` | — | `r16`, `qf`, `sf`, `final` (`type` `knockout`, final `final`) |
| `uae-super-cup` | — | `final` |
| `gulf-club-cl` | `groups` (type `group`) | `qf`, `sf`, `final` |
| `asian-cup` | `groups` | `r16`, `qf`, `sf`, `final` (placeholders already in the data) |

Two-legged ties: add `"leg": 1` / `"leg": 2`. The second leg is the one with the teams swapped.
