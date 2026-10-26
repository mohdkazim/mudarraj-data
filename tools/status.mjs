#!/usr/bin/env node
/**
 * Today's work list for the daily run.
 *   node tools/status.mjs            (window: 4 days back → 21 days ahead, Asia/Dubai dates)
 *   node tools/status.mjs --back 10 --ahead 30
 * Lists: matches that should have a result, results of the last 3 days without goal scorers, kick-off
 * times still unconfirmed, claims waiting for a second source, teams without a crest, and competitions
 * whose fixture list runs out soon.
 *
 * Evening results run (hourly, see RUNBOOK.md):
 *   node tools/status.mjs --results              (matches that kicked off in the last 12 hours)
 *   node tools/status.mjs --results --hours 6
 * Lists only matches that should have finished (kick-off at least 2 hours ago) and still have no
 * result, second-source claims about them, and results recorded in the last 2 hours without scorers
 * (so the run that adds a result and the next one or two look for its scorers; the morning run tries
 * again for 3 days). Prints "NOTHING TO DO" when there is nothing.
 */
import path from "node:path";
import { FINISHED, ROOT, dubaiDate, loadAll, readJSON } from "./lib.mjs";

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
    if (lacksScorers(m)) needScorers.push({ s, m });
  }
}

const line = ({ s, m }) => `  ${m.id}\n      ${dubaiDate(m.kickoff)}  ${name(m.home)} v ${name(m.away)}  [${s.competition}]`;
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
  if (!due.length && !claims.length && !scorers.length) console.log("\nNOTHING TO DO");
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
console.log(`\nPOSTPONED OR ABANDONED — look for a new date or a decision (${watch.length}):`);
for (const x of watch.sort((a, b) => (a.m.kickoff ?? "").localeCompare(b.m.kickoff ?? ""))) console.log(`${line(x)}  ${x.m.status}`);
const pending = readJSON(path.join(ROOT, "data", "pending.json"), []);
console.log(`\nWAITING FOR A SECOND SOURCE (${pending.length}):`);
for (const p of pending) console.log(`  ${p.match ?? "?"}  claim ${p.claim ?? "?"}  from ${(p.sources ?? []).join(", ")}`);
const noCrest = all.teams.filter((t) => !t.logo);
console.log(`\nTEAMS WITHOUT A CREST — add one with "team-logo", see RUNBOOK.md "Crests" (${noCrest.length}):`);
for (const t of noCrest) console.log(`  ${t.id.padEnd(28)} ${t.name.en}${t.countryName?.en ? ` (${t.countryName.en})` : ""}`);
console.log(`\nFIXTURE LISTS (add fixtures when a list ends within the window or a draw has happened):`);
for (const c of all.competitions) {
  const last = lastFixture.get(c.id);
  const flag = !last ? "no fixtures yet" : last < to ? `last fixture ${dubaiDate(new Date(last).toISOString())} — check for new fixtures / draws` : `ok until ${dubaiDate(new Date(last).toISOString())}`;
  console.log(`  ${c.id.padEnd(20)} ${flag}`);
}
