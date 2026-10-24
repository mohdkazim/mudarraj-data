#!/usr/bin/env node
/**
 * Validate, then write dist/football.json — the single file the website downloads.
 *   node tools/build.mjs
 * Refuses to build (exit 1) if validation fails, so the published file is always consistent.
 */
import path from "node:path";
import { ROOT, defaultVenue, loadAll, readJSON, writeJSON } from "./lib.mjs";
import { validate } from "./validate.mjs";

const all = loadAll();
const { errors, warnings } = validate(all);
if (errors.length) {
  for (const e of errors) console.log(`ERROR    ${e}`);
  console.log(`\n✗ not built: ${errors.length} error(s). Fix them, then run again.`);
  process.exit(1);
}

// Matches without a listed venue get the home club's stadium where clubs host their own matches
// (see defaultVenue in lib.mjs); "venueFrom": "home-ground" marks those in the published file.
const matches = [];
let homeGround = 0;
for (const s of all.seasons.values())
  for (const m of s.matches) {
    const out = { competition: s.competition, season: s.season, ...m };
    if (!out.venue) {
      const v = defaultVenue(out, all.compById.get(s.competition), all.teamById);
      if (v) (out.venue = v), (out.venueFrom = "home-ground"), homeGround++;
    }
    matches.push(out);
  }
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
const noVenue = matches.filter((m) => !m.venue).length;
console.log(`✓ built dist/football.json — ${matches.length} matches (${out.counts.results} with results), ${warnings.length} warning(s)`);
console.log(`  venues: ${matches.length - noVenue - homeGround} listed, ${homeGround} home ground, ${noVenue} none (neutral, final or unknown)`);
