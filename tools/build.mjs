#!/usr/bin/env node
/**
 * Validate, then write dist/football.json — the single file the website downloads.
 *   node tools/build.mjs
 * Refuses to build (exit 1) if validation fails, so the published file is always consistent.
 */
import path from "node:path";
import { ROOT, loadAll, readJSON, writeJSON } from "./lib.mjs";
import { validate } from "./validate.mjs";

const all = loadAll();
const { errors, warnings } = validate(all);
if (errors.length) {
  for (const e of errors) console.log(`ERROR    ${e}`);
  console.log(`\n✗ not built: ${errors.length} error(s). Fix them, then run again.`);
  process.exit(1);
}

const matches = [];
for (const s of all.seasons.values()) for (const m of s.matches) matches.push({ competition: s.competition, season: s.season, ...m });
matches.sort((a, b) => (a.kickoff ?? "9999").localeCompare(b.kickoff ?? "9999") || a.id.localeCompare(b.id));

const pending = readJSON(path.join(ROOT, "data", "pending.json"), []);
const out = {
  format: "mudarraj-football@1",
  generatedAt: new Date().toISOString(),
  counts: { teams: all.teams.length, competitions: all.competitions.length, matches: matches.length, results: matches.filter((m) => m.score).length, pending: pending.length },
  teams: all.teams,
  competitions: all.competitions,
  matches,
};
writeJSON(path.join(ROOT, "dist", "football.json"), out);
writeJSON(path.join(ROOT, "dist", "summary.json"), { format: out.format, generatedAt: out.generatedAt, counts: out.counts });
console.log(`✓ built dist/football.json — ${matches.length} matches (${out.counts.results} with results), ${warnings.length} warning(s)`);
