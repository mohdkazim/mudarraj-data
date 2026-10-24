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
| Kooora / 365Scores (enough alone) | `<home> <away>` (Arabic names for Kooora) | `kooora.com` or `365scores.com` | match pages and reports — see the limits below |

- **Don't put `espn.com`, `reuters.com` or `apnews.com` in `allowed_domains`:** the search tool rejects the whole request.
- **Kooora (tested 24 Oct 2026):** searches find current pages (match pages, reports), but most have long Arabic addresses that the fetch tool refuses ("url exceeds the maximum fetchable length"). Short `kooora.com/?n=…` links open; they are often older articles, so check the date.
- **365Scores (tested 24 Oct 2026):** pages open and its scores matched ours (LALIGA round 9, 10 of 10), but the copy the fetch tool gets can be more than a day old (its LALIGA page still showed 23 Oct as "today" on the 24th). A page showing "scheduled", "today" or "tomorrow" for a match that has been played is out of date, not evidence.
- **Check the date of a report:** searches also return older meetings of the same teams.
- **In the evening, laliga.com and ESPN lag behind** (24 Oct 2026: Rayo 0-3 Elche was FT on Sky but still "VS" on laliga.com; ESPN's undated feed still showed 18 Oct).

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
- **2026-27:** Al Ain v Shabab Al Ahli, 29 Nov 2026, 19:30 UAE, Mohammed bin Zayed Stadium (Al Bayan). In 2025-26 a draw went straight to penalties after 90 minutes: record that as `PEN` with `"et": [0, 0]`.

### Gulf Club Champions League (`gulf-club-cl`)
- **Format 2026-27:** three groups of four, home and away, 13 Oct 2026 – 17 Feb 2027; the top two in each group plus the two best third-placed teams reach two-legged quarter-finals (2–17 Mar 2027); semi-finals and final 23–30 Apr 2027 (check whether the semi-finals are one match).
- **Tier 2:** each club's national press: QNA, Al Raya, Qatar Tribune, The Peninsula (Qatar) · SPA, Okaz, Sabq, Al Yaum (Saudi) · KUNA, Kuwait Times, Al Rai (Kuwait) · ONA, Oman Observer, Oman Daily (Oman) · BNA, GDN, Akhbar Al Khaleej (Bahrain) · INA (Iraq) · Emarat Al Youm, Al Khaleej, WAM (UAE clubs). Many reports are agency copy: count an article credited to an agency as that agency.
- **Tier 3:** Wikipedia "2026–27 AGCFF Gulf Club Champions League"
- No readable official site found. Kick-off times are rarely published in advance: store the date with `"timeConfirmed": false` until a Tier 1/2 site gives the time.

### AFC Asian Cup 2027 (`asian-cup`)
- **Tier 1:** the-afc.com
- **Tier 2:** ESPN feed `…/soccer/afc.asian.cup/…`
- **Note:** in October 2026 the AFC said it was considering a postponement. Follow official announcements only.
