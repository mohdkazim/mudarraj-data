#!/usr/bin/env node
/**
 * Today's work list for the daily run.
 *   node tools/status.mjs            (window: 4 days back → 21 days ahead, Asia/Dubai dates)
 *   node tools/status.mjs --back 10 --ahead 30
 * Lists: matches that should have a result, kick-off times still unconfirmed, claims waiting for a
 * second source, and competitions whose fixture list runs out soon.
 */
import path from "node:path";
import { FINISHED, ROOT, dubaiDate, loadAll, readJSON } from "./lib.mjs";

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : def;
};
const back = arg("back", 4);
const ahead = arg("ahead", 21);
const now = Date.now();
const from = now - back * 86400_000;
const to = now + ahead * 86400_000;
const all = loadAll();
const name = (id) => all.teamById.get(id)?.name.en ?? id ?? "TBD";

const needResult = [];
const needTime = [];
const watch = []; // postponed or abandoned: waiting for a new date or a decision
const lastFixture = new Map();
for (const s of all.seasons.values()) {
  for (const m of s.matches) {
    const t = m.kickoff ? Date.parse(m.kickoff) : null;
    if (t && (lastFixture.get(s.competition) ?? 0) < t) lastFixture.set(s.competition, t);
    if (m.status === "PST" || m.status === "ABD") watch.push({ s, m });
    if (!t) continue;
    if (t < now - 2.5 * 3600_000 && t >= from && !FINISHED.has(m.status) && !["CANC", "PST", "ABD"].includes(m.status)) needResult.push({ s, m });
    if (t >= now && t <= to && m.timeConfirmed === false) needTime.push({ s, m });
  }
}

const line = ({ s, m }) => `  ${m.id}\n      ${dubaiDate(m.kickoff)}  ${name(m.home)} v ${name(m.away)}  [${s.competition}]`;
console.log(`Window (Dubai): ${dubaiDate(new Date(from).toISOString())} → ${dubaiDate(new Date(to).toISOString())}\n`);
console.log(`NEEDS A RESULT (${needResult.length}):`);
for (const x of needResult.sort((a, b) => a.m.kickoff.localeCompare(b.m.kickoff))) console.log(line(x));
console.log(`\nKICK-OFF TIME NOT CONFIRMED (${needTime.length}):`);
for (const x of needTime.sort((a, b) => a.m.kickoff.localeCompare(b.m.kickoff))) console.log(line(x));
console.log(`\nPOSTPONED OR ABANDONED — look for a new date or a decision (${watch.length}):`);
for (const x of watch.sort((a, b) => (a.m.kickoff ?? "").localeCompare(b.m.kickoff ?? ""))) console.log(`${line(x)}  ${x.m.status}`);
const pending = readJSON(path.join(ROOT, "data", "pending.json"), []);
console.log(`\nWAITING FOR A SECOND SOURCE (${pending.length}):`);
for (const p of pending) console.log(`  ${p.match ?? "?"}  claim ${p.claim ?? "?"}  from ${(p.sources ?? []).join(", ")}`);
console.log(`\nFIXTURE LISTS (add fixtures when a list ends within the window or a draw has happened):`);
for (const c of all.competitions) {
  const last = lastFixture.get(c.id);
  const flag = !last ? "no fixtures yet" : last < to ? `last fixture ${dubaiDate(new Date(last).toISOString())} — check for new fixtures / draws` : `ok until ${dubaiDate(new Date(last).toISOString())}`;
  console.log(`  ${c.id.padEnd(20)} ${flag}`);
}
