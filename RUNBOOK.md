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
   - **NEEDS A RESULT:** look the match up on the competition's sources and confirm the score (see the rule above). Record half-time if a source shows it. For extra time or penalties, record `regular`, `et` and `pens`; a shoot-out straight after 90 minutes (no extra time played, as in the Coppa Italia before the final and the Super Cups) is `PEN` with `"noExtraTime": true`, `regular` equal to the score and no `et`. Record the goal scorers too (see "Goal scorers").
   - **NEEDS SCORERS** (results of the last 3 days without goal scorers): find one trusted page that lists every goal with its minute and add them (see "Goal scorers"). Not found → leave it; after 3 days a match drops off the list.
   - **KICK-OFF TIME NOT CONFIRMED:** look for the time on a Tier 1 or 2 site.
   - **WAITING FOR A SECOND SOURCE:** try to confirm or correct each claim.
   - **FIXTURE LISTS:** when a list ends inside the window, or a draw or schedule announcement happened, add the new fixtures. Fill knockout placeholders once the teams are known: use a `fixture` op with the existing match id plus `home`/`away`.
   - **CHECK FOR POSTPONEMENTS** (the matches of the next 48 hours, by competition): search each competition's news once for a postponement, cancellation or move, and record what you find (see "Postponements" below). Also whenever a page you read for anything else says a match was postponed, cancelled or abandoned.
   - **POSTPONED OR ABANDONED** (listed by `status.mjs`): look for the new date or the organiser's decision. New date → `fixture` op with the existing `match` id and the new `kickoff` (the match goes back to "not started"). Result awarded or the match resumed and finished → `result` op.
   - **TEAMS WITHOUT A CREST:** find each club's crest and add it with a `team-logo` op (see "Crests" below). Normally this list is empty; a club added without a crest shows up here the next morning.
   - **SQUADS TO CHECK** (at most 15 a morning): copy each club's current squad from its 365Scores squad page, English and Arabic, as one `squad` op per club (see "Squads" below). A squad that hasn't changed gets the same op again, so the club leaves the list until its next check.
   - **Venues:** when a source lists a match's stadium and it isn't the home club's usual ground (finals and other neutral venues, single-match cup rounds, a club hosting elsewhere), add a `venue` op (see "Venues" below).
   - **Mondays:** add a `table-check` for each league table (EPL from Sky Sports, LALIGA from laliga.com, others when a Tier 1 or 2 table is readable). Copy `played` and `points` for every team and set `asOf` to when that table was last updated. The build then fails if our results don't add up to the same table. That's how missing or wrong results are caught.

3. **Write the patch** `patches/<UAE date>.json`. The format is documented at the top of `tools/apply.mjs`. Stage keys and table ids are in `data/competitions.json`, team ids in `data/teams.json`. A club that isn't listed needs a `team` op first, with its English and Arabic names from a Tier 1 or 2 source (Arabic news sites and official Arabic pages are best), and its crest in `logo` (see "Crests"; add the crest page to the op's `sources`).

4. **Apply and build:**
   ```bash
   node tools/apply.mjs patches/<date>.json
   node tools/build.mjs
   ```
   Rejected changes are listed with the reason. Fix and re-apply them in a second patch (`patches/<date>-b.json`) if there's a better source, or leave them under `unconfirmed`.

5. **Publish:**
   ```bash
   git add -A && git commit -m "data: <date> — <n> results, <s> scorers, <m> fixtures, <q> squads" && git push
   ```

6. **Report** in a few lines:
   - what changed: results, scorers and fixtures added or moved, squads copied or rechecked (and recent results still without scorers)
   - what is still waiting for a second source
   - anything that failed: unreadable sources, rejected changes

## Goal scorers

Every run that records a result also records its goal scorers, and `node tools/status.mjs` lists results still without them under NEEDS SCORERS (evening runs: results recorded in the last 2 hours; morning run: the last 3 days).

- **One page with every goal.** Use one trusted page (Tier 1, Kooora/365Scores, or Tier 2) that lists every goal with its minute. Tested pages and how to reach them are in `SOURCES.md` ("Goal scorers"). The goals must add up to the score; the tools reject a list that doesn't.
- **With a new result:** add `"goals"` (and `"ht"` when the page shows it) to its `result` op. If the pages that confirmed the score don't list every goal, make one more search for a page that does.
- **For a result already recorded** (NEEDS SCORERS): send a `result` op that repeats the recorded status and score exactly as `status.mjs` prints them (for AET and PEN also `regular`, `et` and `pens`, or `noExtraTime` as printed), adds `"goals"` (and `"ht"`), and lists the scorers page in `sources`. One Tier 1, Kooora/365Scores or Tier 2 page is enough; `apply.mjs` answers "added scorers to the confirmed result".
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
   It lists matches that kicked off in the last 12 hours, should have finished (kick-off at least 2 hours ago: 90 minutes, half-time and stoppage time) and still have no result, second-source claims about them, and results recorded in the last 2 hours that still have no scorers (NEEDS SCORERS). The first run of the evening (16:35) also lists LATER TODAY: the matches still to come today, to check once for postponements.
2. **"NOTHING TO DO" → stop.** No web lookups, no commit, no report. Most runs end here.
3. Otherwise confirm each listed result exactly as in step 2 above (same sources, same rules: one Tier 1, or two different Tier 2, or Tier 2 + Tier 3; single-source claims go under `unconfirmed`). A match that is still going (extra time, a late kick-off, a delay) or has no confirmed result yet is simply left for the next run. Record each result's scorers with it, and try once for each match under NEEDS SCORERS (see "Goal scorers"). Scorers often appear a little after the score; a later run or the morning run tries again.
   - **A listed match turns out postponed, abandoned or cancelled** (the pages you read for its result say so): record it now with a `status` change (see "Postponements"), so the site stops showing it as in progress or "result due".
   - **LATER TODAY** (16:35 run only): one search per group of competitions for postponements of those matches (see "Postponements"); record any you find.
4. Write `patches/<UAE date>-<HHMM>.json` (e.g. `patches/2026-10-24-2135.json`, so runs never overwrite each other or the morning patch), then `node tools/apply.mjs` and `node tools/build.mjs` as in step 4.
5. Publish only if the build passes, also when the run only added scorers or a postponement: `git commit -m "data: <UAE date> <HH:MM> — <n> results, <s> scorers"` (add `, <p> postponed` when there are some) and push. Push rejected → `git pull --rebase`, build again, push.
6. **No report when things went normally** — the morning run reports the day. Only report a problem that stopped publishing (no GitHub access, a build you couldn't fix, a push that kept failing).

Don't do in an evening run: fixture lists, kick-off times, venues, crests, new dates for postponed matches, table checks, older gaps from previous days. Those are the morning run's. (Recording that a listed or LATER TODAY match was postponed or abandoned is the evening run's job: see above.)

## Venues

- Every club has a home stadium in `data/teams.json` (`venue`, English and Arabic name and city). The build gives each league, group-stage and two-legged match the home club's stadium automatically (`venueFrom: "home-ground"` in the published file).
- A match gets its own venue (`venue` op, one Tier 1 or Tier 2 source) only when it's played elsewhere: finals and other neutral venues (add `"neutral": true`), single-match cup rounds such as the UAE President's Cup, a club hosting away from its ground. Finals, neutral stages and national-team tournaments never get a venue automatically.
- A club changes ground (new stadium, renovation, AFC/UEFA stadium rules, a neutral home venue for the whole season) → `team-venue` op with the new stadium and a Tier 1 or Tier 2 source.
- A new club (`team` op) should include its `venue` when the source gives it.
- Never guess: no venue is better than a wrong one. Evening runs don't do venues.

## Postponements

A postponed match that stays "not started" in the data shows on the site as scheduled, then "in progress" and "result due". (Mohamed spotted Al Nassr v Al Wasl, ACL Elite 26 Oct, still listed on the evening it should have been played: the AFC had postponed it the day before.) So the runs look for postponements before kick-off, not only after.

- **When:** the morning run checks the matches of the next 48 hours (CHECK FOR POSTPONEMENTS in `node tools/status.mjs`); the 16:35 evening run checks today's remaining matches (LATER TODAY in `--results`); every run records one it comes across while reading about something else.
- **How to look** (one search per group of competitions, then open the articles the search returns; a postponement is news, so news sites carry it within hours):
  - AFC competitions and the Gulf Club Champions League: WebSearch `<competition> postponed` (e.g. `AFC Champions League Elite postponed`) with `allowed_domains: ["the-afc.com", "thenationalnews.com", "khaleejtimes.com", "gulfnews.com", "arabnews.com", "spa.gov.sa"]`; in Arabic `تأجيل مباراة <team>` with the Gulf papers.
  - Saudi competitions: WebSearch `<home> <away> postponed` or `Saudi Pro League postponed` with `allowed_domains: ["arabnews.com", "saudigazette.com.sa", "spa.gov.sa"]`, or `تأجيل مباراة <team>` with `["okaz.com.sa", "sabq.org", "alriyadh.com", "alyaum.com"]`.
  - UAE competitions: `تأجيل مباراة <team>` with `["uaeproleague.ae", "wam.ae", "aletihad.ae", "alkhaleej.ae", "albayan.ae", "emaratalyoum.com"]`; English with `["thenationalnews.com", "gulfnews.com", "khaleejtimes.com"]`.
  - European competitions: `<competition> postponed` with `allowed_domains: ["skysports.com"]`; the organiser's own site for LALIGA (laliga.com), the Bundesliga (bundesliga.com), Serie A (legaseriea.it: search without a filter).
  - Check each article is about this season's match and this date: searches also return older postponements of the same teams.
- **Record it:** `{ "op": "status", "match": "<match id>", "status": "PST", "sources": ["…"] }` — one Tier 1 or Tier 2 source (the organiser, or a reputable paper or agency). Leave out `kickoff`: the original date stays and the site shows "مؤجلة / Postponed" with "the new date appears here once announced". Cancelled for good → `CANC`. Stopped during play → `ABD` (the morning run then follows the organiser's decision: replay, resumption or awarded result).
- **Moved, not postponed** (a new date or time is already announced): a `fixture` change with the match id and the new `kickoff`, nothing else.
- **New date announced later:** the match is listed every morning under POSTPONED OR ABANDONED; once the organiser gives the new date, a `fixture` change with the match id and the new `kickoff` puts it back to "not started".
- **Doubtful only** ("may be postponed", "at risk"): record nothing; the next run checks again.

## Crests

Every club on the site shows its crest; a club without one shows a circle with its 3-letter code. Mohamed doesn't want any club without a crest, so every new club gets one, and `node tools/status.mjs` lists any club still without one (TEAMS WITHOUT A CREST).

- **Where crests come from:** only hosts the site's image proxy allows (`LOGO_HOSTS` in `tools/lib.mjs`); the tools reject any other link. Try in this order (tested 26 Oct 2026):
  1. **TheSportsDB** (most clubs, European, Asian and Gulf): WebSearch `<club name> thesportsdb team` with `allowed_domains: ["thesportsdb.com"]` → open the club's team page (`thesportsdb.com/team/<id>-<name>`; a match, venue or season page showing the club works too) and copy its badge link `https://r2.thesportsdb.com/images/media/team/badge/<file>.png` exactly (a trailing `/medium`, `/small` or `/tiny` is dropped automatically: that's a smaller copy of the same badge). Check the page is the right club: name, town, country and league.
  2. **365Scores** (when TheSportsDB doesn't have the club): WebSearch `<club name>` with `allowed_domains: ["365scores.com"]` → open the club's team page (`365scores.com/football/team/<name>-<id>`; a standings or match page links it) and copy the crest link from the page header exactly (`https://imagecache.365scores.com/image/upload/f_png,w_64,h_64,…/Competitors/<id>`).
  3. **ESPN** (only when an ESPN page or feed you already opened in this run gives the club's ESPN team id; never search with `espn.com` in `allowed_domains`): `https://a.espncdn.com/i/teamlogos/soccer/500/<ESPN team id>.png`. The German and Italian clubs' crests come from here.
- **Op:** `{ "op": "team-logo", "team": "<team id>", "logo": "<crest link>", "sources": ["<the page you copied it from>"] }`. A new club: put the link in the `team` op's `logo` instead and add that page to its `sources`.
- **Copy, never build:** take the link from a page you opened in this run. Don't put together a TheSportsDB file name or a 365Scores id from memory: a wrong link shows nothing.
- **Not found** on any of the three → leave it (the club keeps its code circle), mention it in the report, and the next morning run tries again.
- **Wrong or outdated crest** (a club rebrands) → `team-logo` with the new link replaces it.

## Squads

Every team page and match page shows the club's current squad (Mohamed, 27 Oct 2026: "add the squad before each match and also in each teams page"). The squads live in `data/squads/<team id>.json` and are published as `dist/squads.json`. `node tools/status.mjs` lists the clubs to copy or recheck (SQUADS TO CHECK): clubs in a league we follow or with a match still to play, and national teams with a match in the next three weeks. A squad is rechecked every 30 days, every 7 during transfer windows (January, mid-June to mid-September); status lists at most 15 a morning, oldest first.

- **Where squads come from (tested 27 Oct 2026):** 365Scores' squad page (enough on its own, see SOURCES.md "Squads"): it lists every player with shirt number, position and nationality, and its Arabic version gives the Arabic names. Official sites don't work for this: bundesliga.com lists names and positions without numbers or nationalities; uaeproleague.ae's squad list and ESPN's squad pages come out empty to the reader.
- **Opening the pages:** the fetch tool opens a link only when it came from a search in this run or appears in the text of a page you fetched. So when you fetch a page, ask it to give the exact links you'll need next (the squad tab, the Arabic version, the clubs' pages); those you can then open. Searches are limited per run: find clubs through their league's table rather than one search per club.
  1. **The clubs' pages:** WebSearch `<league or cup name> 365scores standings` (e.g. "Premier League 365scores standings") with `allowed_domains: ["365scores.com"]` → the competition's table page; fetch it asking for each club's team page link (`365scores.com/<locale>/football/team/<name>-<id>`). For a single club: WebSearch `<club name> squad 365scores` with the same filter. Match a club by country and league, not only its name: namesakes (Al Hilal Omdurman, Al Ahli of another country), youth, reserve and women's teams come up too. A link's slug can be misleading (a "lebanon-50" link turned out to be Bournemouth): go by the page.
  2. **English list:** fetch the club's squad tab (`…/squad`) asking for every player as `shirt number | full name | position | nationality` in the page's order, how many players it lists, and the exact link of the page's Arabic version (`/ar/…/squad`).
  3. **Arabic list:** fetch that Arabic link for `shirt number | name | position | nationality` in the page's order: the same players in the same order. If the Arabic link is refused, fetch the club's Arabic team page instead (from the Arabic version of the league table, or WebSearch `<Arabic club name> 365scores` with the same filter) and take its squad tab ("قائمة الفريق"). Different counts or numbers → fetch once more; still different → pair by shirt number and leave out the Arabic name of the rest. Players the Arabic page writes in Latin letters simply get no Arabic name.
  4. **Errors:** 365Scores sometimes answers with a server error, more often when many pages are asked for at once: open one page at a time, and retry a failed page once after a short pause; then move on (the club stays on the list).
- **Op:** `{ "op": "squad", "team": "<team id>", "players": [ { "n": 1, "name": "David Raya", "ar": "ديفيد رايا", "pos": "Goalkeeper", "nat": "Spain" }, … ], "sources": ["<English squad page>", "<Arabic squad page>"] }`. The whole squad, as the page writes it: `n` the shirt number (null without one), `name` the English page's spelling, `ar` the Arabic page's, `pos` and `nat` the English page's words. `tools/squads.mjs` turns positions into groups and roles (Centre Back → DF/CB) and nationalities into codes (Ivory Coast → CI, England → GB-ENG); an unknown position rejects the squad, an unknown nationality is left out and reported — add a real one to `ALIASES` or `POSITION_WORDS` there.
- **Unchanged squad:** the same op again; the tool notes "squad unchanged (rechecked)" and keeps the date of the check, so the club leaves the list for another 30 days.
- **Not found**, or the page lists no players → leave it and mention it in the report; the club stays on the list.
- **National teams:** their squads change with each call-up, so status lists a national team only when it has a match in the next three weeks. Copy the squad its 365Scores page shows (the latest call-up) the same way; when a tournament squad is announced (the Asian Cup's: late December 2026), recheck it.
- **Never** fill in a squad from memory, from a news article's list of signings, or by adding a player you know joined: only the page's own list.

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
| `bundesliga` | `{"key":"regular","type":"league","round":N}` (34 matchdays) | — |
| `serie-a` | `{"key":"regular","type":"league","round":N}` (38 matchdays) | — |
| `dfb-pokal` | — | `r1`, `r2`, `r16`, `qf`, `sf` (`type` `knockout`), `final` (`type` `final`); single matches, extra time then penalties |
| `coppa-italia` | — | `prelim`, `r1`, `r2`, `r16`, `qf` (`type` `knockout`), `sf` (two legs: `"leg": 1` / `"leg": 2`), `final` (`type` `final`) |

Two-legged ties: add `"leg": 1` / `"leg": 2`. The second leg is the one with the teams swapped.
