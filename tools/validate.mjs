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
import { DATA, FINISHED, STAGE_TYPES, STATUSES, confirmation, dubaiDate, isoOk, loadAll, pairOk, readJSON } from "./lib.mjs";

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
  }

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
        if (m.status === "AET" || m.status === "PEN") {
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
