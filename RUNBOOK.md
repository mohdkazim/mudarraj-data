# Daily data run — runbook

Two scheduled Claude runs keep the data up to date (a person can follow this too):

- **Morning run, 05:36 UAE — the full update** (the Steps below): results, goal scorers still missing, fixtures, kick-off times, second sources, Monday table checks.
- **Evening results runs, hourly 16:35–02:35 UAE — results and their scorers** (see "Evening results run" further down): adds the results of matches that finished in the last few hours, with their goal scorers, so the site shows them about an hour after full time.

Late European kick-offs end by about 02:00 UAE time, so by the morning run every result from the day before should be published somewhere.

## Ground rules

1. **Never from memory.** Every score, date or kick-off time must come from a page read during this run, and its URL goes in `sources`.
2. **Use `SOURCES.md`.** A result needs one Tier 1 site, or one "enough alone" site (Kooora, 365Scores), or two different Tier 2 sites, or one Tier 2 plus one Tier 3. The tools enforce this and reject anything less. With a single source, check the page's date, season and both teams: searches also return older meetings of the same teams.
3. **When in doubt, leave it out.** Put a single-source claim under `unconfirmed`, and the next run re-checks it. A day-old gap is better than a wrong score.
4. **Times are stored in UTC** (ISO, e.g. `2026-10-29T14:10:00Z`). Dates in file names and logs are UAE dates.
5. **Never hand-edit `data/`.** All changes go through a patch, `tools/apply.mjs` and `tools/build.mjs`. The one exception is fixing the structure in `data/competitions.json` (groups, rounds) when an organiser changes a format; say so in the commit message.
6. **Never push a failing dataset.** If `tools/build.mjs` fails, fix the cause or drop the change.
7. **Goal scorers: part of every result, all or none.** Every run that records a result also looks for its scorers (see "Goal scorers" below). List a match's goals only when one trusted page gives every goal (scorer and minute). A partial list misleads; leave `goals` out instead.
8. **Stay inside this repository.** Don't change anything else, and don't work around a site that refuses the automated reader (BBC, The Guardian): use another source from `SOURCES.md`.
9. **Be efficient.** One scores or results page usually covers a whole round; web searches are capped per session, so search once per page you need.
10. **Scheduled runs open pages through search.** In an unattended run the fetch tool only opens links returned by a web search in that run (or links on a page it fetched). A link typed in directly, from this file, `SOURCES.md` or the task prompt, or built by adding a date or an id, is refused after waiting for an approval nobody gives. Search first, with `allowed_domains` set to the trusted sites, then open the link the search returns. Tested recipes are in `SOURCES.md` ("Opening pages in scheduled runs").

## Steps

```bash
# 0. Get the repository (scheduled runs: attach mohdkazim/mudarraj-data with push access first)
git clone https://github.com/mohdkazim/mudarraj-data.git && cd mudarraj-data   # or: git pull

# 1. What needs doing today
node tools/status.mjs
```

2. **Gather facts** for everything listed:
   - **NEEDS A RESULT:** look the match up on the competition's sources and confirm the score (see the rule above). Record half-time if a source shows it. For extra time or penalties, record `regular`, `et` and `pens`. Record the goal scorers too (see "Goal scorers").
   - **NEEDS SCORERS** (results of the last 3 days without goal scorers): find one trusted page that lists every goal with its minute and add them (see "Goal scorers"). Not found → leave it; after 3 days a match drops off the list.
   - **KICK-OFF TIME NOT CONFIRMED:** look for the time on a Tier 1 or 2 site.
   - **WAITING FOR A SECOND SOURCE:** try to confirm or correct each claim.
   - **FIXTURE LISTS:** when a list ends inside the window, or a draw or schedule announcement happened, add the new fixtures. Fill knockout placeholders once the teams are known: use a `fixture` op with the existing match id plus `home`/`away`.
   - **Postponed, cancelled or abandoned** matches: use a `status` op (Tier 1 or 2 source).
   - **POSTPONED OR ABANDONED** (listed by `status.mjs`): look for the new date or the organiser's decision. New date → `fixture` op with the existing `match` id and the new `kickoff` (the match goes back to "not started"). Result awarded or the match resumed and finished → `result` op.
   - **Venues:** when a source lists a match's stadium and it isn't the home club's usual ground (finals and other neutral venues, single-match cup rounds, a club hosting elsewhere), add a `venue` op (see "Venues" below).
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
   git add -A && git commit -m "data: <date> — <n> results, <s> scorers, <m> fixtures" && git push
   ```

6. **Report** in a few lines:
   - what changed: results, scorers and fixtures added or moved (and recent results still without scorers)
   - what is still waiting for a second source
   - anything that failed: unreadable sources, rejected changes

## Goal scorers

Every run that records a result also records its goal scorers, and `node tools/status.mjs` lists results still without them under NEEDS SCORERS (evening runs: results recorded in the last 2 hours; morning run: the last 3 days).

- **One page with every goal.** Use one trusted page (Tier 1, Kooora/365Scores, or Tier 2) that lists every goal with its minute. Tested pages and how to reach them are in `SOURCES.md` ("Goal scorers"). The goals must add up to the score; the tools reject a list that doesn't.
- **With a new result:** add `"goals"` (and `"ht"` when the page shows it) to its `result` op. If the pages that confirmed the score don't list every goal, make one more search for a page that does.
- **For a result already recorded** (NEEDS SCORERS): send a `result` op that repeats the recorded status and score exactly as `status.mjs` prints them (for AET and PEN also `regular`, `et` and `pens`), adds `"goals"` (and `"ht"`), and lists the scorers page in `sources`. One Tier 1, Kooora/365Scores or Tier 2 page is enough; `apply.mjs` answers "added scorers to the confirmed result".
- **Format:** one entry per goal, in time order: `{ "minute": 45, "extra": 2, "side": "home", "player": "Name", "type": "goal" }`.
  - `side`: the team the goal counts for. An own goal counts for the other team, and `player` is the player who scored it.
  - `type`: `goal`, `penalty` or `own-goal`.
  - Stoppage time: 45+2 → minute 45, extra 2. Extra time uses minutes 91–120 (105+1 → minute 105, extra 1). Shoot-out kicks are never goals.
  - Copy names as the page spells them; prefer an English page's spelling.
- **Not found:** leave it. An empty timeline is better than a wrong one.

## Evening results run (hourly, 16:35–02:35 UAE)

A small run with one job: results of matches that have just finished, with their scorers. Everything else waits for the morning run.

1. Get the repository as in step 0, then:
   ```bash
   node tools/status.mjs --results
   ```
   It lists matches that kicked off in the last 12 hours, should have finished (kick-off at least 2 hours ago: 90 minutes, half-time and stoppage time) and still have no result, second-source claims about them, and results recorded in the last 2 hours that still have no scorers (NEEDS SCORERS).
2. **"NOTHING TO DO" → stop.** No web lookups, no commit, no report. Most runs end here.
3. Otherwise confirm each listed result exactly as in step 2 above (same sources, same rules: one Tier 1, or two different Tier 2, or Tier 2 + Tier 3; single-source claims go under `unconfirmed`). A match that is still going (extra time, a late kick-off, a delay) or has no confirmed result yet is simply left for the next run. Record each result's scorers with it, and try once for each match under NEEDS SCORERS (see "Goal scorers"). Scorers often appear a little after the score; a later run or the morning run tries again.
4. Write `patches/<UAE date>-<HHMM>.json` (e.g. `patches/2026-10-24-2135.json`, so runs never overwrite each other or the morning patch), then `node tools/apply.mjs` and `node tools/build.mjs` as in step 4.
5. Publish only if the build passes, also when the run only added scorers: `git commit -m "data: <UAE date> <HH:MM> — <n> results, <s> scorers"` and push. Push rejected → `git pull --rebase`, build again, push.
6. **No report when things went normally** — the morning run reports the day. Only report a problem that stopped publishing (no GitHub access, a build you couldn't fix, a push that kept failing).

Don't do in an evening run: fixture lists, kick-off times, venues, postponed matches, table checks, older gaps from previous days. Those are the morning run's.

## Venues

- Every club has a home stadium in `data/teams.json` (`venue`, English and Arabic name and city). The build gives each league, group-stage and two-legged match the home club's stadium automatically (`venueFrom: "home-ground"` in the published file).
- A match gets its own venue (`venue` op, one Tier 1 or Tier 2 source) only when it's played elsewhere: finals and other neutral venues (add `"neutral": true`), single-match cup rounds such as the UAE President's Cup, a club hosting away from its ground. Finals, neutral stages and national-team tournaments never get a venue automatically.
- A club changes ground (new stadium, renovation, AFC/UEFA stadium rules, a neutral home venue for the whole season) → `team-venue` op with the new stadium and a Tier 1 or Tier 2 source.
- A new club (`team` op) should include its `venue` when the source gives it.
- Never guess: no venue is better than a wrong one. Evening runs don't do venues.

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
| `saudi-pro-league` | `{"key":"regular","type":"league","round":N}` (34 rounds) | — |
| `saudi-kings-cup` | — | `r32`, `r16`, `qf`, `sf` (`type` `knockout`), `final` (`type` `final`); single matches |
| `saudi-super-cup` | — | `sf` (`type` `knockout`), `final` (`type` `final`); neutral venue (Kuwait, Dec 2026) |

Two-legged ties: add `"leg": 1` / `"leg": 2`. The second leg is the one with the teams swapped.
