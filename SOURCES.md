# Trusted sources

The daily run only records facts it read that day on these sites, never from memory. Each site has a trust tier (machine-readable copy: `sources.json`).

| Tier | Meaning | Examples |
|---|---|---|
| **1 — Official** | The organiser itself | uaeproleague.ae, uaefa.ae, laliga.com, premierleague.com, uefa.com, the-afc.com |
| **Enough alone** | Not organisers, but count on their own like Tier 1 (Mohamed's decision, 24 Oct 2026) | kooora.com, 365scores.com |
| **2 — Reputable media / data** | Professional newsrooms and data services with editorial checks | Sky Sports, ESPN, Reuters, AP · UAE: WAM, The National, Gulf News, Khaleej Times, Al Khaleej, Al Bayan, Al Ittihad, Emarat Al Youm, Sharjah24, Gulf Today · Gulf: the national news agencies (QNA, SPA, KUNA, BNA, ONA, INA) and main national papers (full list in `sources.json`) |
| **3 — Cross-check only** | Community-maintained or archive sites; never enough on their own | Wikipedia, TheSportsDB, RSSSF, Transfermarkt, worldfootball.net |

**A result is published only when confirmed:** one Tier 1 site, or one "enough alone" site (Kooora, 365Scores), or two different Tier 2 sites, or one Tier 2 plus one Tier 3 site. Otherwise it waits in `data/pending.json` until the next run finds a second source.

**With a single source, check it's this fixture:** the page's date, season and both teams must match. Searches also return older meetings of the same teams (365Scores titles such as "Sharjah SC 1 - 1 Dubai United (10/24)" are from an earlier season), and a second source no longer catches that.

**Sources must be independent.** Newspapers often print agency copy. An article credited to an agency ("— QNA", "(WAM)", "قنا", "وام", "كونا", "واس") counts as that agency, so it is never a second source next to the agency's own report. Two papers printing the same agency story are one source.

**Kick-off times** need one Tier 1 or Tier 2 site. A time seen only on a Tier 3 site is shown as "time to be confirmed".

**Never used:**
- betting sites, social media, forums, fan blogs, AI-generated or unknown aggregator sites
- BBC and The Guardian: reputable, but closed to the automated reader

---

## Opening pages in scheduled runs (tested 24 Oct 2026)

In an unattended scheduled run, the fetch tool only opens links **returned by a web search in that run**, or links on a page it fetched. A link typed in directly (from this file, the runbook or the task prompt, or built by adding a date or an id) is refused after waiting for an approval that never comes. The per-competition links below therefore work as targets: search for them first, then open the link the search returns.

| What | Search | Filter (`allowed_domains`) | Page it returns |
|---|---|---|---|
| Today's European scores (EPL, LALIGA, UCL) | `football scores fixtures` | `skysports.com` | `skysports.com/football-scores-fixtures` (FT or live minute) |
| A month of one competition | `Premier League scores fixtures` (or La Liga, Champions League) | `skysports.com` | `skysports.com/premier-league-scores-fixtures` … |
| LALIGA official results | `Results of LALIGA EA SPORTS 2026/27` | `laliga.com` | `laliga.com/en-GB/laliga-easports/results` (scores appear the day after a match) |
| Second source, European match | `<home> <away> result` | `thenationalnews.com`, `gulfnews.com`, `khaleejtimes.com`, `arabnews.com` | match reports and player ratings |
| Same, in Arabic | Arabic team names | `aletihad.ae`, `alkhaleej.ae`, `albayan.ae`, `emaratalyoum.com` | match reports |
| UAE competitions | Arabic team names + competition | `uaeproleague.ae`, `wam.ae`, `aletihad.ae`, `alkhaleej.ae`, `albayan.ae`, `emaratalyoum.com`, `sharjah24.ae` | reports, official match pages |
| Saudi competitions, enough alone (tested 25 Oct 2026) | `<home> <away>` in English | `365scores.com` | the match page (`…/football/match/saudi-league-649/…`; King's Cup `king's-cup-5501`). Check the date: the same pair's other meeting comes up too |
| Saudi competitions, Tier 2 reports (tested 25 Oct 2026) | `<home> <away> Saudi Pro League result`, or the Arabic names + `دوري روشن` (`كأس الملك`) | `arabnews.com`, `saudigazette.com.sa`; Arabic `okaz.com.sa`, `sabq.org`, `alriyadh.com`, `alyaum.com` | match reports (older meetings appear too: check the date) |
| Bundesliga official, enough alone (tested 26 Oct 2026) | `Bundesliga matchday <n> 2026-2027`, or `<home> <away>` | `bundesliga.com` | the matchday page (kick-offs read as UTC) and its match pages `…/liveticker` (score, half-time, every goal) |
| DFB-Pokal official, enough alone (tested 26 Oct 2026) | German words: `DFB-Pokal Achtelfinale 2026/27 Ergebnisse`, `Auslosung` | `dfb.de` | dfb.de news and Datencenter round pages (German time; a shoot-out shows as `4 : 5 i.E.`) |
| Serie A / Coppa Italia official, enough alone (tested 26 Oct 2026) | `Lega Serie A anticipi posticipi giornata <n>`, `Coppa Italia Frecciarossa ottavi` | none (the filter is rejected for Italian sites) | legaseriea.it schedule articles (Italian time), club pages, Coppa round articles |
| German / Italian scores, Tier 2 (tested 26 Oct 2026) | `Bundesliga scores fixtures`, `Serie A scores fixtures`, `football scores fixtures` | `skysports.com` | month pages (UK time, no year shown) and day pages `…/football-scores-fixtures/<date>`; Corriere dello Sport match pages via an unfiltered search `corrieredellosport <home> <away>` |
| Kooora / 365Scores (enough alone) | `<home> <away>` (Arabic names for Kooora) | `kooora.com` or `365scores.com` | match pages and reports — see the limits below |

- **Don't put `espn.com`, `reuters.com` or `apnews.com` in `allowed_domains`:** the search tool rejects the whole request.
- **Kooora (tested 24 Oct 2026):** searches find current pages (match pages, reports), but most have long Arabic addresses that the fetch tool refuses ("url exceeds the maximum fetchable length"). Short `kooora.com/?n=…` links open; they are often older articles, so check the date.
- **365Scores (tested 24 Oct 2026):** pages open and its scores matched ours (LALIGA round 9, 10 of 10), but the copy the fetch tool gets can be more than a day old (its LALIGA page still showed 23 Oct as "today" on the 24th). A page showing "scheduled", "today" or "tomorrow" for a match that has been played is out of date, not evidence.
- **Check the date of a report:** searches also return older meetings of the same teams.
- **In the evening, laliga.com and ESPN lag behind** (24 Oct 2026: Rayo 0-3 Elche was FT on Sky but still "VS" on laliga.com; ESPN's undated feed still showed 18 Oct).

## Goal scorers (tested 25 Oct 2026)

A match's goals are recorded only from one trusted page that lists **every** goal with its minute (RUNBOOK.md, "Goal scorers"). Pages that do, and how a scheduled run reaches them:

| Competition | Page that lists every goal | How to reach it in a scheduled run |
|---|---|---|
| Premier League, Champions League | Sky Sports live page `skysports.com/football/<home>-vs-<away>/live/<id>`: its header lists each goal with its minute (Aston Villa 2-1 Man City: "6' N Jackson, 52' E Haaland, 60' N Jackson"). Look for pen / og marks | WebSearch `<home> vs <away>` with `allowed_domains: ["skysports.com"]` → open the link ending `/live/<number>`. The plain match page (`…/football/<home>-vs-<away>/<long number>`) loads empty for the reader (it showed 0-0 and no goals) |
| LALIGA | laliga.com match page: every goal with minute (incl. 90+1) and the half-time score (Alavés 3-0 Getafe: 73' Tenaglia, 90+1' Mariano Díaz, 90+4' Mikel Rodríguez; HT 0-0) | the links on the results page (search `Results of LALIGA EA SPORTS 2026/27`, `allowed_domains: ["laliga.com"]`); its matchday pages link every match page |
| ADNOC Pro League, ADIB Cup, EMAAR Super Cup | uaeproleague.ae fixture page `uaeproleague.ae/en/fixtures/<id>`: every goal with minute, scorer and team, own goals marked | a result's own `sources` often include it already; uaeproleague.ae's home page links the current round's fixture pages. A search limited to uaeproleague.ae mostly returns news pages, which are reports, not goal lists |
| AFC Champions League Elite and Two, Gulf Club Champions League, UAE President's Cup, and anything the rows above miss | 365Scores match page (enough alone): goals with minutes and the half-time score (Al Ain 4-0 Al Nassr: 25', 63', 72', 85'; HT 1-0) | WebSearch `<home> <away>` with `allowed_domains: ["365scores.com"]` → the match page. Check the date: searches also return older meetings of the same teams |
| Any | ESPN data feed (Tier 2) `site.api.espn.com/…/scoreboard?dates=YYYYMMDD`: `competitions[0].details` has every scoring play | only when a search or a fetched page gives that exact link (rare in scheduled runs). Often stale for LALIGA and the AFC (frozen mid-match): use it only when the goals add up |

- **Minutes and penalties, page by page (learned filling 341 results, 25 Oct 2026):**
  - uaeproleague.ae fixture timelines count minutes on (a first-half stoppage goal shows as 46' or 47', not 45+1 or 45+2; after 90 they show 92', 98') and never mark penalties. The league's own match report (`uaeproleague.ae/en/news-and-gallery/…`, linked from the fixture page) says which goals were penalties and in stoppage time: read it too.
  - laliga.com: the score header also counts on (45+6 shows as 51'); the match timeline gives 45+6. Use the timeline.
  - Sky Sports pages give initial and surname ("B Barcola"); ESPN gives full names.
  - ESPN's feed has no half-time score. Its scoreboards are often stale (old snapshots); the same feed with an extra parameter (`&lang=en&region=us`, `&limit=50`) or the host `site.web.api.espn.com` returned the final data. The per-match `…/scoreboard/<eventId>` works; `…/summary?event=` is cut off before the goals. Read a feed twice through different links when it matters.
  - Sources sometimes disagree on a scorer (a goal or an own goal, a different player): prefer the organiser's own page (Tier 1), as for scores.
- **Not enough on their own:** the-afc.com match reports (some goals only "after the break"), Sky Sports month pages (`…-scores-fixtures`, no scorers), most news reports (they name scorers but rarely every minute).
- **Arabic UAE papers** (Al Khaleej, Al Bayan, Emarat Al Youm) often list scorers with minutes; use them when nothing else does, and take the Latin spelling from an English page when there is one.

## Per competition (tested 23 Oct 2026)

**Time zones (checked 23 Oct 2026).** Always store UTC.
- ESPN feed: UTC.
- Sky Sports: UK time (BST until 25 Oct 2026, GMT after).
- laliga.com: **shows UTC when read by the fetch tool** (the page draws times in the reader's own time zone, and the reader runs on UTC). Don't convert from Spain time. Cross-check one match against ESPN before trusting a batch.
- TheSportsDB `strTimestamp`: UTC.
- UAE sources: UAE time (UTC+4).
- **Placeholders are not times:** Sky shows unscheduled matches at "Sunday 4:00pm", and ESPN marks them "TBD". Store such matches with `"timeConfirmed": false`.

**Unreadable to the run** (skip them): espn.com web pages (the ESPN data feed works), worldfootball.net, transfermarkt.com, premierleague.com, uefa.com, BBC, The Guardian.

**ESPN, tips (checked 23 Oct 2026):**
- The scoreboard feed (`site.api.espn.com/…/scoreboard?dates=YYYYMMDD`) often stays "scheduled" for days after matches, especially for the AFC competitions. Its kick-off times are right; don't read a missing score as "not played".
- When the scoreboard is stale, ESPN's per-match feed is current: `https://sports.core.api.espn.com/v2/sports/soccer/leagues/<league>/events/<event>/competitions/<event>/status` and `…/competitors/<team>/score` (event and team ids are in the scoreboard). It is the same site as espn.com, so it never counts as a second source next to the scoreboard.
- The reader cuts very long pages at about 88,000 characters: on a 9-match UCL day the last match is missing. Check the count of matches against the fixture list, and look up any missing match on its own.

**TheSportsDB league ids** (free key `123`, season `2026-2027`): Premier League 4328, LALIGA 4335, Champions League 4480, ACL Elite 4719, ACL Two 4804, ADNOC Pro League 4678, ADIB Cup 5198.

### Premier League (`epl`)
- **Tier 2:** Sky Sports results `https://www.skysports.com/premier-league-results`, fixtures `https://www.skysports.com/premier-league-fixtures`, table `https://www.skysports.com/premier-league-table`
- **Tier 2:** ESPN feed by date `https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=YYYYMMDD` (UTC kick-offs)
- **Tier 1:** premierleague.com — official, but loads with JavaScript (unreadable to the run)
- **Note:** ESPN's standings feed was seen out of date; use the Sky Sports table for reference tables.
- **Note:** ESPN's scoreboard can stay "scheduled" (or stuck at half-time) for days after a match. Its kick-off times stay right, but take scores from Sky plus a second source.
- **Tier 3:** TheSportsDB EPL `https://www.thesportsdb.com/api/v1/json/123/eventsround.php?id=4328&r=<round>&s=2026-2027`. The round list can lag behind; single-event lookups (`lookupevent.php?id=<event>`) are current. The by-day list (`eventsday.php?d=YYYY-MM-DD&l=4328`) returns at most 3 matches on the free key.

### LALIGA (`laliga`)
- **Tier 1:** `https://www.laliga.com/en-GB/laliga-easports/results` (matchday list; times appear in UTC to the run, see above), table `https://www.laliga.com/en-GB/laliga-easports/standing`, match pages `https://www.laliga.com/en-GB/match/…` (abandoned or postponed matches are explained there)
- **Tier 2:** Sky Sports `https://www.skysports.com/la-liga-results`, `https://www.skysports.com/la-liga-fixtures`
- **Tier 2:** ESPN feed `…/soccer/esp.1/scoreboard?dates=YYYYMMDD`
- **Note:** ESPN marks unscheduled kick-offs as "TBD" at a placeholder time. Never take a time marked TBD.
- **Note:** LALIGA publishes each matchday's kick-off times only a few weeks ahead. Until then laliga.com shows "-- : --": store the date with `"timeConfirmed": false`.
- **Note:** Sky's month pages (e.g. October fixtures) can lag; `la-liga-results` is current.
- **Tier 3:** TheSportsDB LALIGA: same endpoints with league id `4335`.
- **Open item (23 Oct 2026):** Rayo Vallecano v Athletic Club (matchday 8) was abandoned at 0-0 after 25 minutes. Watch laliga.com for the new date or the decision, then update the match (`fixture` with the new kick-off, or `result`).

### UEFA Champions League (`ucl`)
- **Tier 2:** Sky Sports `https://www.skysports.com/champions-league-results`, `https://www.skysports.com/champions-league-fixtures`
- **Tier 2:** ESPN feed `…/soccer/uefa.champions/scoreboard?dates=YYYYMMDD`. Once seen still "scheduled" two days after the matches, so it's not enough on its own.
- **Tier 2:** Sky Sports table `https://www.skysports.com/champions-league-table` for the weekly reference table (its "Last updated" time is UK time).
- **Tier 3:** Wikipedia "2026–27 UEFA Champions League league phase"
- **Tier 1:** uefa.com — official, but JavaScript-only

### ADNOC Pro League (`uae-pro-league`), ADIB Cup (`uae-league-cup`), EMAAR Super Cup (`uae-super-cup`)
- **Tier 1:** UAE Pro League. Match pages `https://uaeproleague.ae/en/fixtures/<id>` (score, scorers, line-ups) and round reviews in `https://uaeproleague.ae/en/news-and-gallery/…`. Arabic: `/ar/`. The fixtures list and table pages are JavaScript-only, so find match and news pages through search.
- **Tier 2:** WAM (often via `en.aletihad.ae`), The National, Gulf News, Khaleej Times, Al Khaleej, Al Bayan, Al Ittihad, Emarat Al Youm
- **Tier 3:** TheSportsDB. Full rounds: `https://www.thesportsdb.com/api/v1/json/123/eventsround.php?id=4678&r=<round>&s=2026-2027` (Pro League), `id=5198` (ADIB Cup). Good for the fixture list; scores still need confirmation.
- **Official match pages, without searching:** senior Pro League match ids run in sequence: `https://uaeproleague.ae/en/fixtures/22e17fXX-7604-11f1-b32b-0289588efdb9` (XX in hex; rounds 1–11 ≈ 10–a9). ADIB Cup: `https://uaeproleague.ae/en/fixtures/327bXXXX-7625-11f1-b32b-0289588efdb9` (≈ 98d6–9930). Every played match already lists its page in `sources`; the next ids follow on.
- **Look-alike trap:** the uaeproleague.ae homepage also lists Under-23 league matches (ids `6a7a70xx-761b-…`). They show the reverse fixture a day later. Always check the page says "ADNOC PRO LEAGUE" with senior squads.
- **Placeholders:** official pages show "Fri 25 Dec 14:45" for unscheduled ADIB Cup matches (matchdays 5–6). Not a real date.
- **Pro League tie-break:** clubs level on points are separated by head-to-head first (Al Khaleej, 20 Oct 2026: Shabab Al Ahli second "بفارق المواجهات المباشرة"). The table in `data/competitions.json` uses `points-h2h`.

### UAE President's Cup (`uae-presidents-cup`)
- **Format 2026-27:** single-match rounds from the round of 16 (drawn 10 Oct 2026); quarter-finals and semi-finals have their own draws at neutral venues; final at Hazza bin Zayed Stadium. A level match goes to extra time, then penalties. The First Division qualifying round isn't covered.
- **Tier 1:** UAE FA (uaefa.ae)
- **Tier 2:** WAM / Al Ittihad, Gulf News, Khaleej Times, Sharjah24, Al Khaleej, Al Bayan
- **Tier 3:** Wikipedia "2026–27 UAE President's Cup", RSSSF (after the season)

### AFC Champions League Elite (`acle`) and Two (`acl2`)
- **Tier 1:** the-afc.com match reports (`https://www.the-afc.com/en/club/afc_champions_league_elite.html/news/…`)
- **Tier 2:** ESPN feed `…/soccer/afc.champions/…` (Elite) and `…/soccer/afc.cup/…` (Two); often stale, use the per-match feed above. UAE media (Khaleej Times, Gulf Today, Gulf News, The National, WAM) for UAE clubs' matches; QNA and SPA for Qatari and Saudi clubs.
- **Tie-breaks:** ACL Elite league stage = points, goal difference, goals scored, wins (as in 2024-25; `points-gd-gf-wins`). ACL Two and Asian Cup groups = head-to-head first (`points-h2h`).
- **Note:** the-afc.com match reports occasionally contradict themselves (a "four points" that was really six). When a Tier 1 sentence disagrees with the arithmetic of confirmed results, trust the confirmed results and say so in the report.
- **Tier 3:** Wikipedia season pages

### EMAAR Super Cup (`uae-super-cup`)
- **2026-27:** Al Ain v Shabab Al Ahli, 29 Nov 2026, 19:30 UAE, Mohammed bin Zayed Stadium (Al Bayan). In 2025-26 a draw went straight to penalties after 90 minutes: record that as `PEN` with `"noExtraTime": true`, `"regular"` equal to the score and no `"et"`.

### Gulf Club Champions League (`gulf-club-cl`)
- **Format 2026-27:** three groups of four, home and away, 13 Oct 2026 – 17 Feb 2027; the top two in each group plus the two best third-placed teams reach two-legged quarter-finals (2–17 Mar 2027); semi-finals and final 23–30 Apr 2027 (check whether the semi-finals are one match).
- **Tier 2:** each club's national press: QNA, Al Raya, Qatar Tribune, The Peninsula (Qatar) · SPA, Okaz, Sabq, Al Yaum (Saudi) · KUNA, Kuwait Times, Al Rai (Kuwait) · ONA, Oman Observer, Oman Daily (Oman) · BNA, GDN, Akhbar Al Khaleej (Bahrain) · INA (Iraq) · Emarat Al Youm, Al Khaleej, WAM (UAE clubs). Many reports are agency copy: count an article credited to an agency as that agency.
- **Tier 3:** Wikipedia "2026–27 AGCFF Gulf Club Champions League"
- No readable official site found. Kick-off times are rarely published in advance: store the date with `"timeConfirmed": false` until a Tier 1/2 site gives the time.

### AFC Asian Cup 2027 (`asian-cup`)
- **Tier 1:** the-afc.com
- **Tier 2:** ESPN feed `…/soccer/afc.asian.cup/…`
- **Note:** in October 2026 the AFC said it was considering a postponement. Follow official announcements only.

### Roshn Saudi League (`saudi-pro-league`), King's Cup (`saudi-kings-cup`), Saudi Super Cup (`saudi-super-cup`) — added 25 Oct 2026
- **Tier 1:** spl.com.sa (the league's organiser) and saff.com.sa (the federation: King's Cup, Super Cup). Their news, team list (stadiums) and regulation/schedule PDFs read well, but **results, fixtures and match pages load with JavaScript and show nothing** to the reader. Use them for postponements, schedules and names.
- **Enough alone:** 365Scores match pages (search as above), Kooora (long addresses refused).
- **Tier 2:** ESPN feed `…/soccer/ksa.1/scoreboard?dates=YYYYMMDD` (league; team list `…/ksa.1/teams`), `…/soccer/ksa.kings.cup/…` (King's Cup); Arab News, Saudi Gazette, SPA, Okaz, Sabq, Al Riyadh, Al Yaum. In a scheduled run the ESPN feed opens only when a search or fetched page gives the exact link.
- **Times:** Saudi time is UTC+3 (no daylight saving). Kooora showed US Eastern times to the reader (25 Oct 2026): convert with care.
- **League:** 18 clubs, 34 rounds, 13 Aug 2026 – 29 May 2027. Rounds 13–34 were published with one date per round and no times; they're stored on that date at 17:00 UTC with `"timeConfirmed": false` until the league sets them (matches then spread over 2–3 days). Moved matches keep their original round (R9 Al Ahli v Al Nassr → 6 Mar 2027 etc.). Table tie-break during the season: goal difference, then goals scored (`points-gd-gf`); head-to-head decides only the final standings. Relegation: 16th–18th.
- **King's Cup:** single matches, extra time then penalties; open draws after each round. Round of 16 on 30 Nov – 1 Dec 2026, quarter-finals 22–23 Feb 2027, semi-finals 4–5 May 2027; the final's date and venue are to be announced. Lower-division clubs host the round of 32.
- **Super Cup (2026 edition):** Al Qadsiah v Al Ahli (19 Dec) and Al Nassr v Al Kholood (20 Dec), final 23 Dec, all at Jaber Al-Ahmad International Stadium, Kuwait (neutral). A draw goes straight to penalties: record `PEN` with `"noExtraTime": true`, `"regular"` equal to the score and no `"et"`. The final's kick-off time isn't published by a trusted site yet.
- **Crests:** TheSportsDB badges (`r2.thesportsdb.com`), as the site shows them; API-Football ids for these clubs and competitions weren't found. How to find a crest: RUNBOOK.md "Crests".

### Bundesliga (`bundesliga`), DFB-Pokal (`dfb-pokal`), Serie A (`serie-a`), Coppa Italia (`coppa-italia`) — added 26 Oct 2026
- **Tier 1, Bundesliga: bundesliga.com** (DFL). Matchday pages `bundesliga.com/en/bundesliga/matchday/2026-2027/<n>` list the matchday's matches with kick-off times (**shown in UTC to the reader**, no label; checked against CET in bundesliga.com's own fixtures article), and scores once played (a page copy can miss the latest scores: open the match page). Each links its match page `…/<n>/<home-slug>-vs-<away-slug>/liveticker`: final and half-time score and every goal with minute and scorer — the goal summary lists an own goal under the team that benefits without marking it, the live text says "OWN GOAL". Reach them with a WebSearch limited to `bundesliga.com` (`Bundesliga matchday 8 2026-2027`, or `<home> <away>`). Unscheduled matchdays say "This Matchday has not yet been scheduled" with a date range. Rules: DFL Spielordnung PDF on `media.dfl.de`.
- **Tier 1, DFB-Pokal: dfb.de and its Datencenter** (`datencenter.dfb.de`): round pages with results and kick-offs in **German time** (CET/CEST), match pages with half-time, 90-minute and 120-minute scores. For a shoot-out the round page shows the shoot-out score itself (`4 : 5 i.E.`); our `score` is the score after 120 minutes. Rules and round dates: dfb.de "Modus" and "Wettbewerbsinformationen" pages.
- **Tier 1, Serie A and Coppa Italia: legaseriea.it** (Lega Serie A): schedule articles ("Quando si gioca: anticipi e posticipi …", referee lists) give each matchday's matches with **Italian local time** (no zone printed), club pages (`legaseriea.it/team/<club>/`) show recent results, and the Coppa Italia pages carry round articles and highlight titles ("Sassuolo-Frosinone 5-4 d.c.r." — **a shoot-out is written as a total**: 1-1 plus 4-3 on penalties). The standings page loads no data for the reader, and many PDFs linked from articles are refused. Reach pages with a WebSearch (the site's own name helps: "Lega Serie A anticipi posticipi giornata"), then follow links.
- **Tier 2:** ESPN feed `…/soccer/ger.1/…` (Bundesliga), `ita.1` (Serie A), `ger.dfb_pokal` ("German Cup"), `ita.coppa_italia`: kick-offs in UTC; `timeValid` false = TBD placeholder (20:00Z, 18:00Z in summer), so store `timeConfirmed: false`; scoring plays in `competitions[0].details` (an own goal is credited to the team that benefits). **A date with more than about 7 finished matches is cut off by the reader** — read the missing ones with `…/scoreboard/<event id>`. ESPN and bundesliga.com disagreed on 5 of 63 goal lists (a minute, or own goal v the shooter): the organiser's page wins. Sky Sports month pages `skysports.com/bundesliga-scores-fixtures`, `…/serie-a-scores-fixtures` (scores, UK times, no year shown; one Sky page had a Bundesliga match on the wrong day).
- **Enough alone:** 365Scores match pages, Kooora.
- **Unreadable:** kicker.de (robots).
- **Times:** Germany and Italy are UTC+1 from 25 Oct 2026, UTC+2 from 28 Mar 2027.
- **Bundesliga:** 18 clubs, 34 matchdays (28 Aug 2026 – 22 May 2027); matchday k+17 = matchday k with home and away swapped. The DFL fixes exact times a few matchdays ahead (MD1–11 as of 26 Oct); until then a matchday is stored on its Saturday (Wednesday for MD16, 13 Jan, and MD24, 3 Mar) at 14:30 UTC (13:30 UTC in summer) with `timeConfirmed: false`, and spreads over Friday–Sunday once set. Table: points, goal difference, goals scored (`points-gd-gf`; head-to-head only after both meetings). 17th–18th relegated, 16th plays the 2. Bundesliga's third over two legs.
- **DFB-Pokal:** 64 clubs, single matches, extra time then penalties; an open draw before each round. Round of 16 on 1–2 Dec 2026 (draw Sun 1 Nov, 19:15 German time), quarter-finals 2/3 and 9/10 Feb 2027, semi-finals 20/21 Apr, final Sat 29 May 2027, 20:00 German time, in Berlin. Lower-division clubs host the early rounds.
- **Serie A:** 20 clubs, 38 matchdays (22 Aug 2026 – 30 May 2027), asymmetric calendar (the second half isn't a mirror of the first). Midweek rounds 27–29 Oct 2026 and 5–7 Jan 2027. Lega Serie A fixes times several matchdays ahead (MD1–19 known on 26 Oct); later matchdays are stored on their Sunday at 14:00 UTC (13:00 UTC in summer) with `timeConfirmed: false`. Table: `points-h2h` (head-to-head first; Sky Sport Italia, May 2025: head-to-head points, head-to-head goal difference, goal difference, goals scored, lots; a play-off for the title or 17th place). 18th–20th relegated.
- **Coppa Italia:** 44 clubs (20 Serie A, 20 Serie B, 4 Serie C), bracket fixed in advance (Comunicato Ufficiale n. 209). Single matches; **a draw after 90 minutes goes straight to penalties** (record `PEN` with `"noExtraTime": true`). Preliminary round, first round ("trentaduesimi"), second round ("sedicesimi"), then the eight seeded Serie A clubs (holders Inter among them) join in the round of 16 (1 Dec 2026 – 26 Jan 2027). Quarter-finals 3 and 10 Feb 2027, semi-finals two legs (3 Mar and 21 Apr 2027: `"leg": 1/2`), final Wed 19 May 2027 (time and stadium not yet published). Second sources for small ties: Corriere dello Sport's match pages (`corrieredellosport.it/live/partita/<home>-<away>-<id>`: score, half-time, every goal, penalties; tuttosport.com shows the same data, so never pair the two) and Sky's day pages (`skysports.com/football-scores-fixtures/<date>`).
- **Italian sites in search:** a WebSearch with `allowed_domains` set to Italian papers (gazzetta.it, corrieredellosport.it, sport.sky.it) is rejected by the search tool (HTTP 400): search without a filter and pick their links.
- **Crests:** ESPN's logo server (`a.espncdn.com/i/teamlogos/soccer/500/<ESPN team id>.png`), allowed by the site's image proxy since 26 Oct 2026.
