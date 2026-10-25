#!/usr/bin/env node
/**
 * Validate, then write the files the website downloads:
 *   dist/football-v2.json  everything (sites built from 25 Oct 2026 on; they skip competitions they don't know yet)
 *   dist/football.json     the same without competitions marked "since": 2 in data/competitions.json, for sites
 *                          installed earlier, which can't show a competition they don't know (Saudi football,
 *                          added 25 Oct 2026, is the first)
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
// Optional settings for the site's related-news card (data/news.json): tune it without a NAS update.
const news = readJSON(path.join(ROOT, "data", "news.json"), null);
// Optional settings for the NAS's provisional results from football-data.org (data/provisional.json),
// e.g. {"off": true} switches them off on the site without a NAS update.
const provisional = readJSON(path.join(ROOT, "data", "provisional.json"), null);
const out = {
  format: "mudarraj-football@1",
  generatedAt: new Date().toISOString(),
  counts: { teams: all.teams.length, competitions: all.competitions.length, matches: matches.length, results: matches.filter((m) => m.score).length, pending: pending.length },
  teams: all.teams,
  competitions: all.competitions,
  matches,
  ...(news ? { news } : {}),
  ...(provisional ? { provisional } : {}),
};
// Earlier sites read football.json: leave out the competitions they don't know (marked "since": 2).
const legacyComp = (id) => (all.compById.get(id)?.since ?? 1) <= 1;
const legacyMatches = matches.filter((m) => legacyComp(m.competition));
const legacy = {
  ...out,
  counts: { ...out.counts, competitions: all.competitions.filter((c) => legacyComp(c.id)).length, matches: legacyMatches.length, results: legacyMatches.filter((m) => m.score).length },
  competitions: all.competitions.filter((c) => legacyComp(c.id)),
  matches: legacyMatches,
};
writeJSON(path.join(ROOT, "dist", "football-v2.json"), out);
writeJSON(path.join(ROOT, "dist", "football.json"), legacy);
writeJSON(path.join(ROOT, "dist", "summary.json"), { format: out.format, generatedAt: out.generatedAt, counts: out.counts, legacyCounts: legacy.counts });
const noVenue = matches.filter((m) => !m.venue).length;
console.log(`✓ built dist/football-v2.json — ${matches.length} matches (${out.counts.results} with results), ${warnings.length} warning(s)`);
console.log(`  dist/football.json (sites installed before 25 Oct 2026) — ${legacyMatches.length} matches, without: ${all.competitions.filter((c) => !legacyComp(c.id)).map((c) => c.id).join(", ") || "nothing"}`);
console.log(`  venues: ${matches.length - noVenue - homeGround} listed, ${homeGround} home ground, ${noVenue} none (neutral, final or unknown)`);
