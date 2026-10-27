#!/usr/bin/env node
/**
 * Apply one run's changes:   node tools/apply.mjs patches/2026-10-24.json
 *
 * Patch file:
 * {
 *   "run": "2026-10-24T02:00:00Z",
 *   "changes": [
 *     { "op": "result",  "match": "<id>", "status": "FT", "score": [2,1], "ht": [1,0], "goals": [...], "sources": ["https://…","https://…"] },
 *     { "op": "result",  "competition": "uae-pro-league", "season": "2026-27", "home": "ae-al-ain", "away": "ae-ajman", "date": "2026-10-29", … },
 *     { "op": "fixture", "competition": "…", "season": "…", "stage": {"key":"regular","type":"league","round":8}, "home": "…", "away": "…",
 *       "kickoff": "2026-11-06T13:05:00Z", "timeConfirmed": true, "venue": {...}, "sources": ["https://…"] },
 *     { "op": "status",  "match": "<id>", "status": "PST", "sources": ["https://…"] },   (postponed: leave out kickoff — the
 *        original date stays; the new date comes later as a "fixture" change with the same match id)
 *     { "op": "team",    "team": { "id": "…", "name": {"en":"…","ar":"…"}, "shortName": {...}, "code": "ABC", "country": "qa", "national": false }, "sources": ["https://…"] },
 *     { "op": "team-venue", "team": "<team id>", "venue": { "name": {"en":"…","ar":"…"}, "city": {"en":"…","ar":"…"} }, "sources": ["https://…"] },
 *     { "op": "team-logo", "team": "<team id>", "logo": "https://r2.thesportsdb.com/images/media/team/badge/….png", "sources": ["https://… (the page showing it)"] },
 *     { "op": "squad", "team": "<team id>", "players": [ { "n": 1, "name": "David Raya", "ar": "ديفيد رايا", "pos": "Goalkeeper", "nat": "Spain" }, … ],
 *       "sources": ["https://www.365scores.com/…/squad", "https://www.365scores.com/ar/…/squad"] },   (the whole current squad; see RUNBOOK.md "Squads")
 *     { "op": "venue", "match": "<id>", "venue": {...} | null, "neutral": true, "sources": ["https://…"] },
 *     { "op": "table-check", "competition": "…", "season": "…", "table": "overall", "asOf": "2026-10-23T08:00:00Z",
 *       "rows": [{ "team": "…", "played": 7, "points": 21 }], "sources": ["https://…"] },
 *     { "op": "correction", "match": "<id>", "status": "FT", "score": [1,1], "reason": "…", "sources": [...] },
 *     { "op": "delete",  "match": "<id>", "reason": "…" }
 *   ],
 *   "unconfirmed": [ { "match": "<id>", "claim": "2-1", "sources": ["https://…"] } ]
 * }
 *
 * Result details:
 *   - "score" is the final score; "ht" the half-time score (optional).
 *   - Extra time (AET) or penalties (PEN): also "regular": [h,a] (after 90 min) and "et": [h,a] (goals in extra time);
 *     PEN adds "pens": [h,a] (the shoot-out). A shoot-out straight after 90 minutes (no extra time played, e.g. the
 *     early rounds of the Coppa Italia, the Super Cups): PEN with "noExtraTime": true, "regular" = "score" and no "et".
 *   - "goals" (optional, all or none): one entry per goal, e.g.
 *       { "minute": 45, "extra": 2, "side": "home", "player": "Kodjo Laba", "type": "goal" }
 *     "side" is the team the goal counts for (for an own goal: the team that benefits); "type" is goal, penalty or own-goal;
 *     "extra" is stoppage time (45+2 → minute 45, extra 2). The list must add up to the score, or leave it out.
 *
 * Crests: every team needs one ("logo" in a "team" op, or a "team-logo" op), an https link on a host the
 * site's image proxy allows (LOGO_HOSTS in tools/lib.mjs: ESPN, TheSportsDB, 365Scores, API-Football),
 * with the page it was found on in "sources". See RUNBOOK.md "Crests".
 *
 * Venues: a club's stadium ("team-venue") is used for its home matches in league and group stages and
 * two-legged ties (tools/lib.mjs defaultVenue). Give a match its own "venue" only when it is played
 * elsewhere (a neutral venue, a final, a club hosting away from its ground); "neutral": true marks a
 * neutral venue. Both need one Tier 1 or Tier 2 source.
 *
 * Every change is checked on its own; rejected ones are listed and skipped (the rest still apply).
 * Results need confirmation (see sources.json). Nothing is ever taken from memory: a change without
 * sources is rejected.
 */
import path from "node:path";
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import {
  DATA,
  FINISHED,
  ROOT,
  STAGE_TYPES,
  confirmation,
  dubaiDate,
  fixtureTrust,
  isoOk,
  loadAll,
  logoOk,
  makeMatchId,
  normLogo,
  normVenue,
  pairOk,
  readJSON,
  saveSeason,
  saveTeams,
  venueOk,
  writeJSON,
} from "./lib.mjs";
import { loadSquads, normSquad, sameSquad, saveSquad } from "./squads.mjs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node tools/apply.mjs patches/<date>.json");
  process.exit(2);
}
const patch = readJSON(path.resolve(file));
if (!Array.isArray(patch.changes)) {
  console.error("Patch has no changes[] array.");
  process.exit(2);
}

const all = loadAll();
const squads = loadSquads();
const now = Date.now();
const touched = new Set();
const accepted = [];
const resolved = new Set(); // matches whose result was recorded in this run (their pending claims are done)
const rejected = [];
const label = (c) => c.match ?? (c.home || c.away ? `${c.home ?? "?"} v ${c.away ?? "?"}` : (typeof c.team === "string" ? c.team : c.team?.id) ?? `${c.competition ?? ""} ${c.table ?? ""}`.trim());
const ok = (c, note) => accepted.push(`${c.op} ${label(c)} ${note ?? ""}`.trim());
const no = (c, why) => rejected.push({ change: c, why });

function season(competition, s) {
  const comp = all.compById.get(competition);
  if (!comp) return null;
  const key = `${competition}|${s ?? comp.season}`;
  if (!all.seasons.has(key)) all.seasons.set(key, { competition, season: s ?? comp.season, matches: [] });
  return all.seasons.get(key);
}

function findMatch(c) {
  if (c.match) {
    for (const s of all.seasons.values()) {
      const m = s.matches.find((x) => x.id === c.match);
      if (m) return { s, m };
    }
    return null;
  }
  if (c.competition && c.home && c.away) {
    const s = season(c.competition, c.season);
    if (!s) return null;
    const near = s.matches.filter((x) => x.home === c.home && x.away === c.away && (c.leg ? x.leg === c.leg : true));
    if (c.date) {
      const target = Date.parse(`${c.date}T12:00:00Z`);
      const best = near
        .filter((x) => x.kickoff && Math.abs(Date.parse(x.kickoff) - target) <= 4 * 86400_000)
        .sort((a, b) => Math.abs(Date.parse(a.kickoff) - target) - Math.abs(Date.parse(b.kickoff) - target))[0];
      if (best) return { s, m: best };
    }
    if (near.length === 1) return { s, m: near[0] };
  }
  return null;
}

function scoreFrom(c) {
  if (!pairOk(c.score)) return null;
  const score = { home: c.score[0], away: c.score[1] };
  if (c.ht) score.ht = c.ht;
  if (c.regular) score.regular = c.regular;
  if (c.et) score.et = c.et;
  if (c.pens) score.pens = c.pens;
  return score;
}

function checkResultShape(c) {
  if (!FINISHED.has(c.status) && c.status !== "ABD") return `status must be FT, AET, PEN, AWD or ABD (got ${c.status})`;
  if (FINISHED.has(c.status) && !pairOk(c.score)) return "needs score [home, away]";
  if (c.ht && !pairOk(c.ht)) return "bad half-time score";
  if (c.noExtraTime !== undefined && (c.noExtraTime !== true || c.status !== "PEN")) return 'noExtraTime: true is only for PEN (a shoot-out straight after 90 minutes)';
  if (c.noExtraTime) {
    if (c.et !== undefined) return "noExtraTime: leave out et";
    if (!pairOk(c.regular) || c.regular[0] !== c.score[0] || c.regular[1] !== c.score[1]) return "noExtraTime: regular [h,a] must equal score";
  } else if (c.status === "AET" || c.status === "PEN") {
    if (!pairOk(c.regular) || !pairOk(c.et)) return `${c.status} needs regular [h,a] and et [h,a] (or, for a shoot-out straight after 90 minutes, "noExtraTime": true)`;
    if (c.regular[0] + c.et[0] !== c.score[0] || c.regular[1] + c.et[1] !== c.score[1]) return "regular + et must equal score";
  }
  if (c.status === "PEN" && (!pairOk(c.pens) || c.pens[0] === c.pens[1])) return "PEN needs a decisive pens [h,a]";
  if (c.goals !== undefined) {
    if (!Array.isArray(c.goals)) return "goals must be a list";
    const tally = { home: 0, away: 0 };
    for (const g of c.goals) {
      if (!g || !Number.isInteger(g.minute) || g.minute < 1 || g.minute > 130) return "each goal needs a minute (1-130)";
      if (g.extra !== undefined && g.extra !== null && (!Number.isInteger(g.extra) || g.extra < 1 || g.extra > 20)) return "goal extra (stoppage) minutes must be 1-20";
      if (g.side !== "home" && g.side !== "away") return 'each goal needs side "home" or "away"';
      if (typeof g.player !== "string" || !g.player.trim()) return "each goal needs a player name";
      if (!["goal", "penalty", "own-goal"].includes(g.type)) return "goal type must be goal, penalty or own-goal";
      tally[g.side]++;
    }
    if (c.goals.length && pairOk(c.score) && (tally.home !== c.score[0] || tally.away !== c.score[1]))
      return `goal list (${tally.home}-${tally.away}) doesn't add up to the score — list every goal or none`;
  }
  return null;
}

for (const c of patch.changes) {
  try {
    if (!Array.isArray(c.sources) && c.op !== "delete") {
      no(c, "no sources — every change must say where it came from");
      continue;
    }
    switch (c.op) {
      case "result":
      case "correction": {
        const found = findMatch(c);
        if (!found) {
          no(c, "match not found (add the fixture first)");
          break;
        }
        const { s, m } = found;
        const shape = checkResultShape(c);
        if (shape) {
          no(c, shape);
          break;
        }
        const newScore = scoreFrom(c);
        const known = FINISHED.has(m.status) && m.score && c.op !== "correction";
        if (known && m.status === c.status && m.score.home === newScore?.home && m.score.away === newScore?.away) {
          // Same result as already confirmed: keep the extra sources and fill in details that were missing
          // (half-time, scorers). One Tier 1 or 2 source is enough for details of a confirmed result.
          if (fixtureTrust(c.sources) !== "trusted") {
            no({ ...c, match: m.id }, "details for a confirmed result need a Tier 1 or Tier 2 source");
            break;
          }
          m.sources = [...new Set([...(m.sources ?? []), ...c.sources])];
          const added = [];
          if (c.ht && !m.score.ht) (m.score.ht = c.ht), added.push("half-time");
          if (c.goals?.length && !m.goals?.length) (m.goals = c.goals), added.push("scorers");
          touched.add(s);
          resolved.add(m.id);
          ok({ ...c, match: m.id }, added.length ? `added ${added.join(" and ")} to the confirmed result` : "already recorded — extra source kept");
          break;
        }
        const conf = confirmation(c.sources);
        if (!conf.ok) {
          no({ ...c, match: m.id }, conf.reason);
          break;
        }
        const kickoff = c.kickoff && isoOk(c.kickoff) ? c.kickoff : m.kickoff;
        if (!kickoff || Date.parse(kickoff) > now + 30 * 60_000) {
          no(c, `kick-off ${kickoff} is in the future — if the match was moved, include the actual "kickoff"`);
          break;
        }
        if (known) {
          no(c, `conflicts with the recorded ${m.score.home}-${m.score.away} ${m.status}; use op "correction" with a reason`);
          break;
        }
        if (c.op === "correction" && !c.reason) {
          no(c, "a correction needs a reason");
          break;
        }
        m.kickoff = kickoff;
        m.status = c.status;
        m.score = c.status === "ABD" && !newScore ? null : newScore;
        if (c.goals) m.goals = c.goals;
        if (c.venue) m.venue = c.venue;
        m.sources = c.sources;
        m.updatedAt = new Date(now).toISOString();
        if (c.op === "correction") m.correction = { reason: c.reason, at: m.updatedAt };
        touched.add(s);
        resolved.add(m.id);
        ok({ ...c, match: m.id }, `${m.score ? `${m.score.home}-${m.score.away}` : ""} ${m.status}`);
        break;
      }
      case "fixture": {
        const trust = fixtureTrust(c.sources);
        if (trust === "blocked" || trust === "none") {
          no(c, "fixture needs at least one listed source");
          break;
        }
        const existing = findMatch(c);
        if (existing) {
          const { s, m } = existing;
          if (FINISHED.has(m.status)) {
            // re-sending a fixture that has since been played is harmless; a different kick-off is not
            if (!c.kickoff || Date.parse(c.kickoff) === Date.parse(m.kickoff)) ok({ ...c, match: m.id }, "already played — nothing to change");
            else no(c, "match already has a result; a different kick-off needs a correction");
            break;
          }
          if (c.kickoff !== undefined) {
            if (c.kickoff !== null && !isoOk(c.kickoff)) {
              no(c, `bad kickoff ${c.kickoff}`);
              break;
            }
            m.kickoff = c.kickoff;
            m.timeConfirmed = trust === "trusted" ? c.timeConfirmed !== false : false;
            // a tie that was waiting for its date ("TBD") is now scheduled
            if (c.kickoff && m.status === "TBD") m.status = "NS";
          }
          const unknown = ["home", "away"].find((side) => c[side] && m[side] === null && !all.teamById.has(c[side]));
          if (unknown) {
            no(c, `unknown team ${c[unknown]} — add it with op "team" first`);
            break;
          }
          for (const side of ["home", "away"]) {
            if (c[side] && m[side] === null) {
              m[side] = c[side];
              m[`${side}Placeholder`] = null;
            }
          }
          if (c.venue) m.venue = c.venue;
          if (c.stage?.round && !m.stage.round) m.stage.round = c.stage.round;
          // a postponed or abandoned match with a new date is back on the schedule
          if ((m.status === "PST" || m.status === "ABD") && c.kickoff && Date.parse(c.kickoff) > now) {
            m.status = "NS";
            m.score = null;
          }
          m.sources = [...new Set([...(m.sources ?? []), ...c.sources])].slice(-6);
          touched.add(s);
          ok({ ...c, match: m.id }, `kick-off ${m.kickoff ?? "TBC"}`);
          break;
        }
        const s = season(c.competition, c.season);
        if (!s) {
          no(c, `unknown competition ${c.competition}`);
          break;
        }
        if (!c.stage?.key || !STAGE_TYPES.includes(c.stage.type)) {
          no(c, "fixture needs stage {key, type}");
          break;
        }
        for (const side of ["home", "away"]) {
          if (c[side] && !all.teamById.has(c[side])) throw new Error(`unknown team ${c[side]} — add it with op "team" first`);
          if (!c[side] && !(c[`${side}Placeholder`]?.en && c[`${side}Placeholder`]?.ar)) throw new Error(`${side} needs a team id or a placeholder {en, ar}`);
        }
        if (c.kickoff !== null && c.kickoff !== undefined && !isoOk(c.kickoff)) throw new Error(`bad kickoff ${c.kickoff}`);
        const m = {
          id: c.id ?? makeMatchId(s.competition, s.season, c),
          stage: { key: c.stage.key, type: c.stage.type, group: c.stage.group ?? null, round: c.stage.round ?? null },
          kickoff: c.kickoff ?? null,
          timeConfirmed: trust === "trusted" ? c.timeConfirmed !== false : false,
          home: c.home ?? null,
          away: c.away ?? null,
          homePlaceholder: c.home ? null : c.homePlaceholder,
          awayPlaceholder: c.away ? null : c.awayPlaceholder,
          ...(c.leg ? { leg: c.leg } : {}),
          status: c.kickoff ? "NS" : "TBD",
          score: null,
          venue: c.venue ?? null,
          neutral: !!c.neutral,
          sources: c.sources,
        };
        if (s.matches.some((x) => x.id === m.id)) {
          no(c, `match id ${m.id} already exists`);
          break;
        }
        s.matches.push(m);
        touched.add(s);
        ok({ ...c, match: m.id }, "added");
        break;
      }
      case "status": {
        const found = findMatch(c);
        if (!found) {
          no(c, "match not found");
          break;
        }
        if (!["PST", "CANC", "ABD", "NS", "TBD"].includes(c.status)) {
          no(c, "status op is for PST, CANC, ABD, NS or TBD");
          break;
        }
        if (fixtureTrust(c.sources) !== "trusted") {
          no(c, "a status change needs a Tier 1 or Tier 2 source");
          break;
        }
        const { s, m } = found;
        if (FINISHED.has(m.status)) {
          no(c, "match already has a result (use correction)");
          break;
        }
        if (c.kickoff !== undefined && c.kickoff !== null && !isoOk(c.kickoff)) {
          no(c, `bad kickoff ${c.kickoff}`);
          break;
        }
        m.status = c.status;
        // A postponement keeps the original date (the site shows it with "Postponed" until the new date is
        // added with a "fixture" change); "kickoff": null is ignored rather than wiping the date.
        if (c.kickoff) m.kickoff = c.kickoff;
        m.sources = [...new Set([...(m.sources ?? []), ...c.sources])].slice(-6);
        touched.add(s);
        resolved.add(m.id);
        ok({ ...c, match: m.id }, c.status);
        break;
      }
      case "team": {
        const t = c.team;
        if (!t?.id || !t.name?.en || !t.name?.ar) {
          no(c, "team needs id and name {en, ar}");
          break;
        }
        if (all.teamById.has(t.id)) {
          no(c, `team ${t.id} already exists`);
          break;
        }
        const logo = typeof t.logo === "string" ? normLogo(t.logo) : null;
        if (t.logo != null && !logoOk(logo, { local: false })) {
          no(c, `logo must be an https link on a crest host the site shows (see LOGO_HOSTS in tools/lib.mjs), got ${t.logo}`);
          break;
        }
        const team = {
          id: t.id,
          name: t.name,
          shortName: t.shortName ?? t.name,
          code: (t.code ?? t.name.en.replace(/[^A-Za-z]/g, "").slice(0, 3)).toUpperCase(),
          national: !!t.national,
          country: t.country ?? "",
          countryName: t.countryName ?? { en: "", ar: "" },
          logo,
          color: t.color ?? null,
          venue: t.venue ?? null,
          aliases: t.aliases ?? [],
          apiFootballId: t.apiFootballId ?? null,
        };
        all.teams.push(team);
        all.teamById.set(team.id, team);
        saveTeams(all.teams);
        ok(c, logo ? `team ${t.id} added` : `team ${t.id} added — no crest yet: add one with "team-logo" (RUNBOOK.md "Crests")`);
        break;
      }
      case "team-logo": {
        const t = all.teamById.get(c.team);
        if (!t) {
          no(c, `unknown team ${c.team}`);
          break;
        }
        const logo = typeof c.logo === "string" ? normLogo(c.logo) : null;
        if (!logoOk(logo, { local: false })) {
          no(c, `logo must be an https link on a crest host the site shows (see LOGO_HOSTS in tools/lib.mjs), got ${c.logo}`);
          break;
        }
        if (!c.sources.length || !c.sources.every((u) => typeof u === "string" && /^https:\/\//.test(u))) {
          no(c, "sources: the https page(s) where this crest was found");
          break;
        }
        const before = t.logo ?? null;
        t.logo = logo;
        saveTeams(all.teams);
        ok({ ...c, team: t.id }, before === logo ? "crest unchanged" : before ? `crest replaced (was ${before})` : "crest added");
        break;
      }
      case "squad": {
        // The club's whole current squad, as a trusted page lists it (RUNBOOK.md "Squads"). Positions and
        // nationalities may be the page's words; tools/squads.mjs turns them into codes and reports unknown ones.
        const t = all.teamById.get(c.team);
        if (!t) {
          no(c, `unknown team ${c.team}`);
          break;
        }
        if (fixtureTrust(c.sources) !== "trusted") {
          no(c, "a squad needs a Tier 1 or Tier 2 source, or a site that is enough alone (365Scores, Kooora — sources.json)");
          break;
        }
        const { players, problems } = normSquad(c.players);
        if (!players) {
          no(c, problems.join("; "));
          break;
        }
        const before = squads.get(t.id);
        const squad = { team: t.id, checked: dubaiDate(patch.run ?? new Date(now).toISOString()), sources: [...new Set(c.sources)], players };
        saveSquad(squad);
        squads.set(t.id, squad);
        const what = !before ? `squad added (${players.length} players)` : sameSquad(before.players, players) ? "squad unchanged (rechecked)" : `squad updated (${players.length} players, was ${before.players.length})`;
        ok({ ...c, team: t.id }, problems.length ? `${what}; ${problems.length} note(s): ${problems.slice(0, 4).join("; ")}${problems.length > 4 ? " …" : ""}` : what);
        break;
      }
      case "table-check": {
        const comp = all.compById.get(c.competition);
        if (!comp?.tables?.some((t) => t.id === c.table)) {
          no(c, "unknown competition or table");
          break;
        }
        if (fixtureTrust(c.sources) !== "trusted") {
          no(c, "a reference table needs a Tier 1 or Tier 2 source");
          break;
        }
        if (!isoOk(c.asOf) || !Array.isArray(c.rows)) {
          no(c, "needs asOf (ISO time) and rows");
          break;
        }
        writeJSON(path.join(DATA, "checks", `${c.competition}-${c.season}-${c.table}.json`), {
          competition: c.competition,
          season: c.season,
          table: c.table,
          asOf: c.asOf,
          rows: c.rows,
          sources: c.sources,
        });
        ok(c, `reference table ${c.competition} ${c.table} (${c.rows.length} rows)`);
        break;
      }
      case "team-venue": {
        const t = all.teamById.get(c.team);
        if (!t) {
          no(c, `unknown team ${c.team}`);
          break;
        }
        if (!venueOk(c.venue)) {
          no(c, "venue needs name {en, ar} (and city {en, ar} if given)");
          break;
        }
        if (fixtureTrust(c.sources) !== "trusted") {
          no(c, "a stadium needs a Tier 1 or Tier 2 source");
          break;
        }
        const before = JSON.stringify(t.venue ?? null);
        t.venue = normVenue(c.venue);
        saveTeams(all.teams);
        ok({ ...c, team: t.id }, before === JSON.stringify(t.venue) ? `stadium confirmed (${t.venue.name.en})` : `stadium set: ${t.venue.name.en}`);
        break;
      }
      case "venue": {
        const found = findMatch(c);
        if (!found) {
          no(c, "match not found");
          break;
        }
        if (c.venue !== null && !venueOk(c.venue)) {
          no(c, "venue needs name {en, ar} (and city {en, ar} if given), or null to clear it");
          break;
        }
        if (fixtureTrust(c.sources) !== "trusted") {
          no(c, "a venue needs a Tier 1 or Tier 2 source");
          break;
        }
        const { s, m } = found;
        if (c.venue === null) delete m.venue;
        else m.venue = normVenue(c.venue);
        if (typeof c.neutral === "boolean") {
          if (c.neutral) m.neutral = true;
          else delete m.neutral;
        }
        m.venueSources = [...new Set([...(m.venueSources ?? []), ...c.sources])];
        touched.add(s);
        ok({ ...c, match: m.id }, c.venue === null ? "venue cleared" : `venue ${m.venue.name.en}${m.neutral ? " (neutral)" : ""}`);
        break;
      }
      case "delete": {
        const found = findMatch(c);
        if (!found || !c.reason) {
          no(c, "delete needs an existing match and a reason");
          break;
        }
        found.s.matches = found.s.matches.filter((x) => x.id !== found.m.id);
        touched.add(found.s);
        ok(c, `deleted (${c.reason})`);
        break;
      }
      default:
        no(c, `unknown op ${c.op}`);
    }
  } catch (e) {
    no(c, e.message);
  }
}

for (const s of touched) saveSeason(s);

// Claims seen in only one source are kept for the next run to re-check.
const pendingFile = path.join(DATA, "pending.json");
const pending = readJSON(pendingFile, []);
const stillPending = [
  ...pending.filter((p) => !resolved.has(p.match)),
  ...(patch.unconfirmed ?? []).map((u) => ({ ...u, seen: patch.run ?? new Date(now).toISOString() })),
  ...rejected
    .filter((r) => r.change.op === "result" && /not enough|no usable/.test(r.why))
    .map((r) => ({ match: r.change.match ?? null, claim: r.change.score?.join("-"), sources: r.change.sources, seen: patch.run ?? null })),
].filter((p, i, arr) => arr.findIndex((q) => q.match === p.match && q.claim === p.claim) === i);
writeJSON(pendingFile, stillPending);

// Log
const day = patch.run ? dubaiDate(patch.run) : dubaiDate(new Date(now).toISOString());
const log = [
  `\n## ${day} (${patch.run ?? new Date(now).toISOString()})`,
  `- ${accepted.length} change(s) applied, ${rejected.length} rejected, ${stillPending.length} waiting for a second source`,
  ...accepted.map((a) => `  - ✓ ${a}`),
  ...rejected.map((r) => `  - ✗ ${r.change.op} ${label(r.change)}: ${r.why}`),
];
const changelog = path.join(ROOT, "CHANGELOG.md");
if (!existsSync(changelog)) writeFileSync(changelog, "# Data changelog\n");
appendFileSync(changelog, log.join("\n") + "\n");

console.log(`✓ applied ${accepted.length}, ✗ rejected ${rejected.length}, pending ${stillPending.length}`);
for (const r of rejected) console.log(`  ✗ ${r.change.op} ${label(r.change)}: ${r.why}`);
