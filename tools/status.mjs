#!/usr/bin/env node
/**
 * Today's work list for the daily run.
 *   node tools/status.mjs            (window: 4 days back → 21 days ahead, Asia/Dubai dates)
 *   node tools/status.mjs --back 10 --ahead 30
 * Lists: matches that should have a result, results of the last 3 days without goal scorers, kick-off
 * times still unconfirmed, matches of the next 48 hours to check for postponements, claims waiting for a
 * second source, teams without a crest, squads to copy or recheck (RUNBOOK.md "Squads"), and competitions whose
 * fixture list runs out soon.
 *
 * Evening results run (hourly, see RUNBOOK.md):
 *   node tools/status.mjs --results              (matches that kicked off in the last 12 hours)
 *   node tools/status.mjs --results --hours 6
 * Lists only matches that should have finished (kick-off at least 2 hours ago) and still have no
 * result, second-source claims about them, and results recorded in the last 2 hours without scorers
 * (so the run that adds a result and the next one or two look for its scorers; the morning run tries
 * again for 3 days). The first evening run (16:xx UAE) also lists the matches still to come today, to
 * check once for postponements (RUNBOOK.md "Postponements"). Prints "NOTHING TO DO" when there is nothing.
 *   node tools/status.mjs --results --later      (list the matches still to come today at any hour)
 */
import path from "node:path";
import { FINISHED, ROOT, dubaiDate, loadAll, readJSON } from "./lib.mjs";
import { loadSquads, squadMaxAgeDays } from "./squads.mjs";

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : def;
};
const back = arg("back", 4);
const ahead = arg("ahead", 21);
const resultsOnly = process.argv.includes("--results");
const hours = arg("hours", 12);
const scorerDays = arg("scorer-days", 3); // morning run: results this recent without scorers
const scorerHours = arg("scorer-hours", 2); // evening runs: results recorded this recently without scorers
const now = Date.now();
const dubaiHour = Number(new Date(now).toLocaleString("en-GB", { timeZone: "Asia/Dubai", hour: "2-digit", hourCycle: "h23" }));
const from = now - back * 86400_000;
const to = now + ahead * 86400_000;
const all = loadAll();
const name = (id) => all.teamById.get(id)?.name.en ?? id ?? "TBD";

// A result with goals but no scorers yet ("all or none": a page must list every goal with its minute).
const lacksScorers = (m) => FINISHED.has(m.status) && m.status !== "AWD" && m.score && m.score.home + m.score.away > 0 && !m.goals?.length;
const needScorers = [];
const needResult = [];
const needTime = [];
const watch = []; // postponed or abandoned: waiting for a new date or a decision
const soon = []; // not started, kicking off in the next 48 hours: check for postponements (morning run)
const later = []; // not started, kicking off in the next 10 hours: check for postponements (first evening run)
const lastFixture = new Map();
for (const s of all.seasons.values()) {
  for (const m of s.matches) {
    const t = m.kickoff ? Date.parse(m.kickoff) : null;
    // Only fixtures with both teams known: a placeholder (a final waiting for its semi-finals) doesn't make a list complete.
    if (t && m.home && m.away && (lastFixture.get(s.competition) ?? 0) < t) lastFixture.set(s.competition, t);
    if (m.status === "PST" || m.status === "ABD") watch.push({ s, m });
    if (!t) continue;
    if (t < now - 2 * 3600_000 && t >= from && !FINISHED.has(m.status) && !["CANC", "PST", "ABD"].includes(m.status)) needResult.push({ s, m });
    if (t >= now && t <= to && m.timeConfirmed === false) needTime.push({ s, m });
    if (t >= now && (m.status === "NS" || m.status === "TBD") && m.home && m.away) {
      if (t <= now + 48 * 3600_000) soon.push({ s, m });
      if (t <= now + 10 * 3600_000) later.push({ s, m });
    }
    if (lacksScorers(m)) needScorers.push({ s, m });
  }
}

// A postponed match may have no date at all ("kickoff": null): print "date TBA" rather than fail.
const line = ({ s, m }) => `  ${m.id}\n      ${m.kickoff ? dubaiDate(m.kickoff) : "date TBA"}  ${name(m.home)} v ${name(m.away)}  [${s.competition}]`;
const dubaiTime = (iso) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dubai", weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
// Matches grouped by competition, one line each: the postponement check searches each competition's news once.
function byCompetition(list) {
  const groups = new Map();
  for (const x of [...list].sort((a, b) => a.m.kickoff.localeCompare(b.m.kickoff))) {
    if (!groups.has(x.s.competition)) groups.set(x.s.competition, []);
    groups.get(x.s.competition).push(x);
  }
  for (const [comp, xs] of groups) {
    console.log(`  ${comp} (${xs.length}):`);
    for (const { m } of xs) console.log(`      ${dubaiTime(m.kickoff)}  ${name(m.home)} v ${name(m.away)}   ${m.id}`);
  }
}
const pair = (p) => `${p[0] ?? p.home}-${p[1] ?? p.away}`;
// The recorded result, as the "result" op that adds scorers must repeat it (status, score, extra time).
const recorded = (m) => {
  const sc = m.score;
  let r = `${sc.home}-${sc.away} ${m.status}`;
  if (sc.regular && sc.et) r += ` (regular ${pair(sc.regular)}, et ${pair(sc.et)}${sc.pens ? `, pens ${pair(sc.pens)}` : ""})`;
  else if (sc.regular && sc.pens) r += ` (regular ${pair(sc.regular)}, noExtraTime, pens ${pair(sc.pens)})`;
  return r;
};
const scorerLine = (x) => `${line(x)}  ${recorded(x.m)}`;

if (resultsOnly) {
  // Only what finished recently: older gaps, fixtures and kick-off times are the morning run's job.
  const since = now - hours * 3600_000;
  const due = needResult.filter(({ m }) => Date.parse(m.kickoff) >= since).sort((a, b) => a.m.kickoff.localeCompare(b.m.kickoff));
  const ids = new Set(due.map(({ m }) => m.id));
  const recentIds = new Set();
  for (const s of all.seasons.values()) for (const m of s.matches) if (m.kickoff && Date.parse(m.kickoff) >= since && Date.parse(m.kickoff) < now) recentIds.add(m.id);
  const claims = readJSON(path.join(ROOT, "data", "pending.json"), []).filter((p) => recentIds.has(p.match));
  console.log(`Results check — matches that kicked off in the last ${hours} hours (Dubai now: ${dubaiDate(new Date(now).toISOString())} ${new Date(now).toLocaleTimeString("en-GB", { timeZone: "Asia/Dubai", hour: "2-digit", minute: "2-digit" })})\n`);
  console.log(`NEEDS A RESULT (${due.length}):`);
  for (const x of due) console.log(line(x));
  console.log(`\nWAITING FOR A SECOND SOURCE (${claims.length}):`);
  for (const p of claims) console.log(`  ${p.match}  claim ${p.claim ?? "?"}  from ${(p.sources ?? []).join(", ")}`);
  const scorers = needScorers
    .filter(({ m }) => m.updatedAt && Date.parse(m.updatedAt) >= now - scorerHours * 3600_000)
    .sort((a, b) => a.m.kickoff.localeCompare(b.m.kickoff));
  console.log(`\nNEEDS SCORERS — results recorded in the last ${scorerHours} hours without goal scorers (${scorers.length}):`);
  for (const x of scorers) console.log(scorerLine(x));
  // First evening run only (16:xx UAE): today's remaining matches, checked once for postponements.
  const checkLater = (dubaiHour === 16 || process.argv.includes("--later")) && later.length > 0;
  if (checkLater) {
    console.log(`\nLATER TODAY — check once whether any of these was postponed; a postponed one gets a "status" change (RUNBOOK.md "Postponements") (${later.length}):`);
    byCompetition(later);
  }
  if (!due.length && !claims.length && !scorers.length && !checkLater) console.log("\nNOTHING TO DO");
  process.exit(0);
}
console.log(`Window (Dubai): ${dubaiDate(new Date(from).toISOString())} → ${dubaiDate(new Date(to).toISOString())}\n`);
console.log(`NEEDS A RESULT (${needResult.length}):`);
for (const x of needResult.sort((a, b) => a.m.kickoff.localeCompare(b.m.kickoff))) console.log(line(x));
const recentScorers = needScorers
  .filter(({ m }) => Date.parse(m.kickoff) >= now - scorerDays * 86400_000)
  .sort((a, b) => a.m.kickoff.localeCompare(b.m.kickoff));
console.log(`\nNEEDS SCORERS — results of the last ${scorerDays} days without goal scorers (${recentScorers.length}):`);
for (const x of recentScorers) console.log(scorerLine(x));
console.log(`\nKICK-OFF TIME NOT CONFIRMED (${needTime.length}):`);
for (const x of needTime.sort((a, b) => a.m.kickoff.localeCompare(b.m.kickoff))) console.log(line(x));
console.log(`\nCHECK FOR POSTPONEMENTS — matches in the next 48 hours: search each competition's news once (RUNBOOK.md "Postponements") (${soon.length}):`);
byCompetition(soon);
console.log(`\nPOSTPONED OR ABANDONED — look for a new date or a decision (${watch.length}):`);
for (const x of watch.sort((a, b) => (a.m.kickoff ?? "").localeCompare(b.m.kickoff ?? ""))) console.log(`${line(x)}  ${x.m.status}`);
const pending = readJSON(path.join(ROOT, "data", "pending.json"), []);
console.log(`\nWAITING FOR A SECOND SOURCE (${pending.length}):`);
for (const p of pending) console.log(`  ${p.match ?? "?"}  claim ${p.claim ?? "?"}  from ${(p.sources ?? []).join(", ")}`);
const noCrest = all.teams.filter((t) => !t.logo);
console.log(`\nTEAMS WITHOUT A CREST — add one with "team-logo", see RUNBOOK.md "Crests" (${noCrest.length}):`);
for (const t of noCrest) console.log(`  ${t.id.padEnd(28)} ${t.name.en}${t.countryName?.en ? ` (${t.countryName.en})` : ""}`);
// Squads (RUNBOOK.md "Squads"): every team gets one (Mohamed, 27 Oct 2026: "I want for all teams to have squads also for
// all matches"). Teams in a league we follow or with a match still to play come first; their squads are rechecked every
// 30 days (7 in transfer windows), the others' every 90. At most 30 a morning while many teams still have none, then 15.
const squads = loadSquads();
const maxAge = squadMaxAgeDays(now);
const active = new Set();
for (const c of all.competitions) for (const tb of c.tables ?? []) for (const id of tb.teams) active.add(id);
for (const s of all.seasons.values())
  for (const m of s.matches) {
    if (!["NS", "TBD", "PST"].includes(m.status)) continue;
    const t = m.kickoff ? Date.parse(m.kickoff) : null;
    for (const id of [m.home, m.away]) if (id && (t === null || t >= now)) active.add(id);
  }
const ageDays = (d) => Math.floor((Date.parse(dubaiDate(new Date(now).toISOString())) - Date.parse(d)) / 86400_000);
// Without a squad first (active teams before the rest, the site's home countries and the big leagues first), then the oldest checks.
const FIRST = ["ae", "sa", "gb-eng", "es", "de", "it", "qa", "fr", "pt", "nl"];
const rank = (id) => {
  const i = FIRST.indexOf(all.teamById.get(id)?.country);
  return (active.has(id) ? 0 : 100) + (i < 0 ? FIRST.length : i);
};
const squadsDue = all.teams
  .map((t) => t.id)
  .filter((id) => !squads.has(id) || ageDays(squads.get(id).checked) >= (active.has(id) ? maxAge : 90))
  .sort((a, b) => (squads.get(a)?.checked ?? "").localeCompare(squads.get(b)?.checked ?? "") || rank(a) - rank(b) || a.localeCompare(b));
const missingSquads = squadsDue.filter((id) => !squads.has(id)).length;
const SQUADS_PER_RUN = missingSquads > 50 ? 30 : 15;
console.log(`\nSQUADS TO CHECK — copy or recheck these teams' squads, see RUNBOOK.md "Squads" (${missingSquads} without a squad; ${squadsDue.length} due${squadsDue.length > SQUADS_PER_RUN ? `, today the first ${SQUADS_PER_RUN}` : ""}):`);
for (const id of squadsDue.slice(0, SQUADS_PER_RUN)) {
  const t = all.teamById.get(id);
  const sq = squads.get(id);
  const arabic = ["ae", "sa", "qa", "kw", "bh", "om", "iq", "jo", "ye", "sy", "lb", "ps", "eg", "ly", "tn", "dz", "ma"].includes(t.country) ? ", Arabic names" : "";
  console.log(`  ${id.padEnd(30)} ${t.name.en}${t.countryName?.en ? ` (${t.countryName.en})` : ""} — ${sq ? `last checked ${sq.checked}` : "no squad yet"}${arabic}`);
}
console.log(`\nFIXTURE LISTS (add fixtures when a list ends within the window or a draw has happened):`);
for (const c of all.competitions) {
  const last = lastFixture.get(c.id);
  const flag = !last ? "no fixtures yet" : last < to ? `last fixture ${dubaiDate(new Date(last).toISOString())} — check for new fixtures / draws` : `ok until ${dubaiDate(new Date(last).toISOString())}`;
  console.log(`  ${c.id.padEnd(20)} ${flag}`);
}
