#!/usr/bin/env node
/**
 * Full-dataset check. Exit code 1 when anything is wrong, so a broken dataset is never published.
 *   node tools/validate.mjs
 * Checks: shapes, team IDs, duplicate matches, status/score consistency, no results for future
 * matches, every result backed by trusted sources, group/league integrity, and — the strongest
 * check — tables computed from our results must equal the reference tables copied from trusted sites.
 */
import { readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { DATA, FINISHED, STAGE_TYPES, STATUSES, confirmation, dubaiDate, isoOk, loadAll, logoOk, pairOk, readJSON, venueOk } from "./lib.mjs";
import { loadSquads, storedPlayerProblem } from "./squads.mjs";

export function validate(all = loadAll(), now = Date.now()) {
  const errors = [];
  const warnings = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

  // ---- teams
  const seenTeams = new Set();
  for (const t of all.teams) {
    if (!t.id || seenTeams.has(t.id)) err("teams", `missing or duplicate id ${t.id}`);
    seenTeams.add(t.id);
    if (!t.name?.en || !t.name?.ar) err(`team ${t.id}`, "needs English and Arabic names");
    if (!t.code) warn(`team ${t.id}`, "no 3-letter code");
    if (t.venue && !venueOk(t.venue)) err(`team ${t.id}`, "venue needs name {en, ar} (and city {en, ar} if given)");
    if (t.logo != null && !logoOk(t.logo)) err(`team ${t.id}`, `crest must be an https link on a host the site's image proxy allows (LOGO_HOSTS in tools/lib.mjs) or a file shipped with the site, got ${t.logo}`);
  }
  const noCrest = all.teams.filter((t) => !t.logo).map((t) => t.id);
  if (noCrest.length) warn("teams", `${noCrest.length} without a crest (${noCrest.join(", ")}): add them with "team-logo" (RUNBOOK.md "Crests")`);

  // ---- squads (data/squads/<team>.json, see tools/squads.mjs)
  for (const [id, sq] of loadSquads()) {
    const where = `squad ${id}`;
    if (sq.team !== id) err(where, "the file name and its team differ");
    if (!all.teamById.has(id)) err(where, "unknown team");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sq.checked ?? "")) err(where, "needs checked (the Dubai date it was copied, YYYY-MM-DD)");
    if (!Array.isArray(sq.sources) || !sq.sources.length || !sq.sources.every((u) => typeof u === "string" && /^https:\/\//.test(u))) err(where, "needs sources (https pages)");
    if (!Array.isArray(sq.players) || sq.players.length < 11) {
      err(where, "needs at least 11 players");
      continue;
    }
    for (const [i, p] of sq.players.entries()) {
      const problem = storedPlayerProblem(p);
      if (problem) err(where, `player ${i + 1}: ${problem}`);
    }
    const numbers = sq.players.map((p) => p.n).filter((n) => n !== null);
    if (new Set(numbers).size !== numbers.length) warn(where, "a shirt number is used twice (as the source lists it)");
  }
  // A player on a 365Scores list and on another club's FotMob list: the 365Scores list is probably out of date
  // (it is slow with transfers). Same name (two words or more) and, when both lists give one, the same
  // nationality. status.mjs puts such clubs on SQUADS TO CHECK.
  const listedBy = new Map();
  const plain = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
  for (const [id, sq] of loadSquads()) {
    for (const p of sq.players ?? []) {
      const key = plain(p.name);
      if (key.split(" ").length < 2) continue;
      if (!listedBy.has(key)) listedBy.set(key, []);
      listedBy.get(key).push({ id, nat: p.nat ?? null, name: p.name, fotmob: (sq.sources ?? []).some((u) => /fotmob\.com/.test(u)) });
    }
  }
  const pairs = new Map();
  for (const list of listedBy.values()) {
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const [a, b] = [list[i], list[j]];
        if (a.id === b.id || (a.nat && b.nat && a.nat !== b.nat) || a.fotmob === b.fotmob) continue;
        const k = [a.id, b.id].sort().join(" and ");
        if (!pairs.has(k)) pairs.set(k, []);
        pairs.get(k).push(a.name);
      }
  }
  for (const [k, names] of pairs) warn(`squads ${k}`, `both list ${names.join(", ")}: the 365Scores list is probably out of date (status lists it to recopy from FotMob)`);

  // ---- competitions
  for (const c of all.competitions) {
    if (!c.season) err(`competition ${c.id}`, "no current season");
    for (const tb of c.tables ?? []) {
      for (const id of tb.teams) if (!all.teamById.has(id)) err(`competition ${c.id} table ${tb.id}`, `unknown team ${id}`);
    }
  }

  // ---- matches
  const ids = new Set();
  const teamDays = new Map();
  for (const [key, s] of all.seasons) {
    const comp = all.compById.get(s.competition);
    if (!comp) {
      err(key, "unknown competition");
      continue;
    }
    const fixtureKeys = new Set();
    const byId = new Map(s.matches.map((m) => [m.id, m]));
    for (const m of s.matches) {
      const where = `${key} ${m.id}`;
      if (!m.id || ids.has(m.id)) err(where, "missing or duplicate match id");
      ids.add(m.id);
      if (!m.stage?.key || !STAGE_TYPES.includes(m.stage.type)) err(where, `bad stage ${JSON.stringify(m.stage)}`);
      if (!STATUSES.includes(m.status)) err(where, `bad status ${m.status}`);
      if (m.venue && !venueOk(m.venue)) err(where, "venue needs name {en, ar} (and city {en, ar} if given)");
      if (m.kickoff !== null && !isoOk(m.kickoff)) err(where, `bad kickoff ${m.kickoff}`);
      if (m.kickoff === null && !["NS", "TBD", "PST", "CANC"].includes(m.status)) err(where, "a played match needs a kickoff time");
      for (const side of ["home", "away"]) {
        const id = m[side];
        if (id === null) {
          const ph = m[`${side}Placeholder`];
          if (!ph?.en || !ph?.ar) err(where, `${side} team unknown and no placeholder text`);
        } else if (!all.teamById.has(id)) err(where, `unknown ${side} team ${id}`);
      }
      if (m.home && m.home === m.away) err(where, "a team can't play itself");

      // duplicates: same stage, same teams, same leg
      if (m.home && m.away) {
        const fk = `${m.stage.key}|${m.stage.group ?? ""}|${m.home}|${m.away}|${m.leg ?? ""}|${m.stage.type === "league" || m.stage.type === "league-phase" ? "" : m.stage.round ?? ""}`;
        if (fixtureKeys.has(fk)) err(where, "duplicate fixture (same stage, teams and leg)");
        fixtureKeys.add(fk);
      }

      // status ↔ score
      const finished = FINISHED.has(m.status);
      if (finished) {
        if (!m.score || !Number.isInteger(m.score.home) || !Number.isInteger(m.score.away)) err(where, `${m.status} needs a score`);
        if (m.kickoff && Date.parse(m.kickoff) > now + 2 * 3600_000) err(where, `has a result but kicks off in the future (${m.kickoff})`);
        const c = confirmation(m.sources ?? []);
        if (!c.ok) err(where, `result not confirmed: ${c.reason}`);
      } else if (m.status !== "ABD" && m.score) err(where, `status ${m.status} must not have a score`);
      if (m.score) {
        const { ht, regular, et, pens } = m.score;
        if (ht && !pairOk(ht)) err(where, "bad half-time score");
        if (ht && (ht[0] > m.score.home || ht[1] > m.score.away)) err(where, "half-time score higher than the final score");
        if (m.status === "PEN" && !et) {
          // a shoot-out straight after 90 minutes (no extra time played): the regular-time score is the final score
          if (!pairOk(regular) || regular[0] !== m.score.home || regular[1] !== m.score.away) err(where, "PEN without extra time needs a regular-time score equal to the final score");
        } else if (m.status === "AET" || m.status === "PEN") {
          if (!pairOk(regular) || !pairOk(et)) err(where, `${m.status} needs regular-time and extra-time scores`);
          else if (regular[0] + et[0] !== m.score.home || regular[1] + et[1] !== m.score.away) err(where, "regular + extra time must add up to the final score");
        }
        if (m.status === "PEN") {
          if (!pairOk(pens) || pens[0] === pens[1]) err(where, "PEN needs a decisive shoot-out score");
          if (!m.leg || m.leg === 1) if (m.score.home !== m.score.away) err(where, "a single match decided on penalties must be level after extra time");
        } else if (pens) err(where, "only PEN matches have a shoot-out");
        if (m.goals?.length) {
          const g = { home: 0, away: 0 };
          for (const x of m.goals) g[x.side]++;
          if (g.home !== m.score.home || g.away !== m.score.away) err(where, `goal list (${g.home}-${g.away}) doesn't add up to the score — list every goal or none`);
        }
      }
      // two-legged: second leg decided on penalties needs a level aggregate
      if (m.leg === 2 && m.status === "PEN" && m.home && m.away) {
        const l1 = s.matches.find((x) => x.leg === 1 && x.stage.key === m.stage.key && x.home === m.away && x.away === m.home);
        if (l1?.score && l1.score.home + m.score.away !== l1.score.away + m.score.home) err(where, "penalties after a second leg need a level aggregate");
      }
      // one match per team per day
      if (m.kickoff && m.status !== "CANC" && m.status !== "PST") {
        for (const id of [m.home, m.away].filter(Boolean)) {
          const k = `${id}|${dubaiDate(m.kickoff)}`;
          if (teamDays.has(k) && teamDays.get(k) !== m.id) warn(where, `${id} also plays ${teamDays.get(k)} the same day`);
          teamDays.set(k, m.id);
        }
      }
      void byId;
    }

    // league / group integrity
    for (const tb of comp.tables ?? []) {
      if (s.season !== comp.season) continue;
      const set = new Set(tb.teams);
      const inTable = s.matches.filter((m) => m.stage.key === tb.stage && (tb.group ? m.stage.group === tb.group : true));
      for (const m of inTable) for (const id of [m.home, m.away]) if (id && !set.has(id)) err(`${key} ${m.id}`, `${id} is not in table ${tb.id}`);
      const pairs = new Map();
      for (const m of inTable) {
        if (!m.home || !m.away) continue;
        const k = `${m.home}>${m.away}`;
        pairs.set(k, (pairs.get(k) ?? 0) + 1);
        if (pairs.get(k) > 1) err(`${key} ${m.id}`, `${m.home} hosts ${m.away} twice in ${tb.id}`);
      }
    }
  }

  // ---- reference tables
  const checksDir = path.join(DATA, "checks");
  if (existsSync(checksDir)) {
    for (const f of readdirSync(checksDir)) {
      if (!f.endsWith(".json")) continue;
      const ck = readJSON(path.join(checksDir, f));
      const s = all.seasons.get(`${ck.competition}|${ck.season}`);
      const comp = all.compById.get(ck.competition);
      const tb = comp?.tables?.find((t) => t.id === ck.table);
      if (!s || !tb) {
        err(`check ${f}`, "unknown competition, season or table");
        continue;
      }
      const asOf = Date.parse(ck.asOf);
      const acc = new Map(tb.teams.map((id) => [id, { played: 0, points: 0 }]));
      for (const m of s.matches) {
        if (!FINISHED.has(m.status) || !m.kickoff || Date.parse(m.kickoff) >= asOf) continue;
        if (m.stage.key !== tb.stage || (tb.group && m.stage.group !== tb.group)) continue;
        const h = acc.get(m.home);
        const a = acc.get(m.away);
        if (!h || !a) continue;
        h.played++;
        a.played++;
        if (m.score.home > m.score.away) h.points += 3;
        else if (m.score.home < m.score.away) a.points += 3;
        else {
          h.points++;
          a.points++;
        }
      }
      for (const row of ck.rows) {
        const got = acc.get(row.team);
        if (!got) {
          err(`check ${f}`, `unknown team ${row.team}`);
          continue;
        }
        if (got.played !== row.played || got.points !== row.points) {
          err(`check ${f}`, `${row.team}: our results give P${got.played} ${got.points}pts, the reference table says P${row.played} ${row.points}pts (a result is missing or wrong)`);
        }
      }
    }
  }

  return { errors, warnings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { errors, warnings } = validate();
  for (const w of warnings) console.log(`warning  ${w}`);
  for (const e of errors) console.log(`ERROR    ${e}`);
  console.log(errors.length ? `\n✗ ${errors.length} error(s), ${warnings.length} warning(s)` : `✓ dataset is valid (${warnings.length} warning(s))`);
  process.exit(errors.length ? 1 : 0);
}
