/**
 * Shared helpers for the data tools. Plain Node (18+), no dependencies.
 * Data layout:
 *   data/teams.json                     team identities (English + Arabic)
 *   data/competitions.json              competitions, current season, structure (tables, rounds)
 *   data/seasons/<competition>/<season>.json   matches
 *   data/checks/<competition>-<season>-<table>.json   reference tables copied from trusted sources
 *   data/pending.json                   claims seen in only one source, re-checked next run
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DATA = path.join(ROOT, "data");

export const STATUSES = ["NS", "TBD", "FT", "AET", "PEN", "PST", "CANC", "ABD", "AWD"];
export const FINISHED = new Set(["FT", "AET", "PEN", "AWD"]);
export const STAGE_TYPES = ["league", "league-phase", "group", "qualifying", "playoff", "knockout", "final"];

export function readJSON(file, fallback) {
  if (!existsSync(file)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing file: ${path.relative(ROOT, file)}`);
  }
  return JSON.parse(readFileSync(file, "utf8"));
}

export function writeJSON(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 1) + "\n");
}

export const seasonFile = (competition, season) => path.join(DATA, "seasons", competition, `${season}.json`);

/** Everything in memory: { teams, teamById, competitions, compById, seasons: Map("comp|season" → {competition, season, matches}) } */
export function loadAll() {
  const teams = readJSON(path.join(DATA, "teams.json"));
  const competitions = readJSON(path.join(DATA, "competitions.json"));
  const seasons = new Map();
  const dir = path.join(DATA, "seasons");
  if (existsSync(dir)) {
    for (const comp of readdirSync(dir)) {
      for (const f of readdirSync(path.join(dir, comp))) {
        if (!f.endsWith(".json")) continue;
        const s = readJSON(path.join(dir, comp, f));
        seasons.set(`${s.competition}|${s.season}`, s);
      }
    }
  }
  return {
    teams,
    teamById: new Map(teams.map((t) => [t.id, t])),
    competitions,
    compById: new Map(competitions.map((c) => [c.id, c])),
    seasons,
  };
}

export function saveSeason(s) {
  s.matches.sort((a, b) => (a.kickoff ?? "9999").localeCompare(b.kickoff ?? "9999") || a.id.localeCompare(b.id));
  writeJSON(seasonFile(s.competition, s.season), s);
}

// ---- venues ----------------------------------------------------------------------------------

const text2 = (x) => !!x && typeof x.en === "string" && x.en.trim() !== "" && typeof x.ar === "string" && x.ar.trim() !== "";

/** A venue is { name: {en, ar}, city?: {en, ar} }. */
export function venueOk(v) {
  if (!v || typeof v !== "object" || !text2(v.name)) return false;
  if (v.city !== undefined && v.city !== null && !text2(v.city)) return false;
  return true;
}

export function normVenue(v) {
  const out = { name: { en: v.name.en.trim(), ar: v.name.ar.trim() } };
  if (v.city) out.city = { en: v.city.en.trim(), ar: v.city.ar.trim() };
  return out;
}

/** Stage types whose matches are played at the home club's ground. */
const HOME_HOSTED = new Set(["league", "league-phase", "group", "playoff"]);

/**
 * The venue a match gets when the data names none: the home club's stadium, but only where clubs host
 * their own matches (league and group stages, two-legged ties, or a stage marked "hosting": "home").
 * Never for finals, neutral stages or tournaments (competition or stage "hosting": "neutral"), matches
 * marked neutral, or national teams. Unknown → null (the site then shows no venue).
 */
export function defaultVenue(m, comp, teamById) {
  if (m.venue || m.neutral || !m.home) return null;
  const home = teamById.get(m.home);
  if (!home?.venue || home.national) return null;
  const stage = comp?.stages?.find((x) => x.key === m.stage?.key);
  const type = m.stage?.type ?? stage?.type;
  if (comp?.hosting === "neutral" || stage?.hosting === "neutral" || type === "final") return null;
  const hosted = HOME_HOSTED.has(type) || Number.isInteger(m.leg) || stage?.hosting === "home";
  return hosted ? home.venue : null;
}

// ---- crests ----------------------------------------------------------------------------------

/**
 * Where a team's crest ("logo") may come from. The site shows crests through its image proxy, which only
 * fetches from these hosts (ALLOWED_HOSTS in the site's src/app/api/img/route.ts): keep the two lists the
 * same. A crest from a host the installed site doesn't know yet shows as the team's code until the NAS
 * update that adds the host (imagecache.365scores.com: site bundle of 26 Oct 2026, afternoon).
 */
export const LOGO_HOSTS = [
  /^media(-\d+)?\.api-sports\.io$/,
  /^media\.api-football\.com$/,
  /^r2\.thesportsdb\.com$/,
  /^www\.thesportsdb\.com$/,
  /^a\.espncdn\.com$/,
  /^imagecache\.365scores\.com$/,
];

/** An https link on a crest host, or a file shipped with the site (a path such as /flags/4x3/ae.svg). */
export function logoOk(logo, { local = true } = {}) {
  if (typeof logo !== "string") return false;
  if (local && /^\/[A-Za-z0-9/_.-]+$/.test(logo)) return true;
  try {
    const u = new URL(logo);
    return u.protocol === "https:" && LOGO_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

/** TheSportsDB also serves smaller copies at <badge>.png/tiny, /small, /medium or /preview: keep the full-size file. */
export const normLogo = (url) =>
  url.trim().replace(/^(https:\/\/r2\.thesportsdb\.com\/images\/media\/team\/badge\/[^/]+\.(?:png|jpe?g|webp))\/(?:tiny|small|medium|preview)$/i, "$1");

export function saveTeams(teams) {
  teams.sort((a, b) => a.id.localeCompare(b.id));
  writeJSON(path.join(DATA, "teams.json"), teams);
}

// ---- sources ------------------------------------------------------------------------------

const SOURCES = readJSON(path.join(ROOT, "sources.json"));

export function siteOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

const matches = (host, domain) => host === domain || host.endsWith(`.${domain}`);

/** 1, 2, 3 for trusted tiers; -1 for sites that must never be used; 0 for unknown sites. */
export function tierOf(url) {
  const host = siteOf(url);
  if (!host) return 0;
  for (const d of Object.keys(SOURCES.never)) if (matches(host, d)) return -1;
  // "enoughAlone": not organisers, but confirm a result on their own like Tier 1 (Mohamed's decision, 24 Oct 2026).
  for (const [tier, key] of [[1, "tier1"], [1, "enoughAlone"], [2, "tier2"], [3, "tier3"]]) {
    for (const d of Object.keys(SOURCES[key] ?? {})) if (!d.startsWith("_") && matches(host, d)) return tier;
  }
  return 0;
}

/** Which registered site a URL belongs to (so two pages of one site count once). */
function siteKey(url) {
  const host = siteOf(url);
  if (!host) return null;
  for (const key of ["tier1", "enoughAlone", "tier2", "tier3"])
    for (const d of Object.keys(SOURCES[key] ?? {})) if (!d.startsWith("_") && matches(host, d)) return d === "site.api.espn.com" ? "espn.com" : d;
  return host;
}

/**
 * Result confirmation rule. Returns { ok, reason, tiers }.
 * ok when: a Tier 1 or "enough alone" site, or two different Tier 2 sites, or one Tier 2 + one Tier 3 site.
 */
export function confirmation(urls = []) {
  const bySite = new Map();
  for (const u of urls) {
    const t = tierOf(u);
    if (t === -1) return { ok: false, reason: `source not allowed: ${siteOf(u)}`, tiers: [] };
    const k = siteKey(u);
    if (!k) continue;
    bySite.set(k, Math.max(bySite.get(k) ?? 0, t));
  }
  const tiers = [...bySite.values()];
  const t1 = tiers.filter((t) => t === 1).length;
  const t2 = tiers.filter((t) => t === 2).length;
  const t3 = tiers.filter((t) => t === 3).length;
  if (t1 >= 1 || t2 >= 2 || (t2 >= 1 && t3 >= 1)) return { ok: true, reason: "confirmed", tiers };
  if (!tiers.length) return { ok: false, reason: "no usable sources", tiers };
  return { ok: false, reason: `not enough independent trusted sources (tier1=${t1}, tier2=${t2}, tier3=${t3})`, tiers };
}

/** Fixture/kick-off info needs one Tier 1 or Tier 2 site (Tier 3 alone → time left unconfirmed). */
export function fixtureTrust(urls = []) {
  const tiers = urls.map(tierOf);
  if (tiers.includes(-1)) return "blocked";
  if (tiers.some((t) => t === 1 || t === 2)) return "trusted";
  if (tiers.some((t) => t === 3)) return "community";
  return "none";
}

// ---- ids and time ----------------------------------------------------------------------------

export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function makeMatchId(competition, season, m) {
  const parts = [competition, season, m.stage.key];
  if (m.stage.group) parts.push(`g${m.stage.group}`);
  if (m.stage.round) parts.push(`r${String(m.stage.round).padStart(2, "0")}`);
  parts.push(m.home ?? "tbd", m.away ?? "tbd");
  if (m.leg) parts.push(`l${m.leg}`);
  return parts.map(slug).join("-");
}

/** Calendar date (YYYY-MM-DD) of an instant in Asia/Dubai (UTC+4, no daylight saving). */
export function dubaiDate(iso) {
  return new Date(Date.parse(iso) + 4 * 3600_000).toISOString().slice(0, 10);
}

export const isoOk = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/.test(s) && !Number.isNaN(Date.parse(s));

export function pairOk(p) {
  return Array.isArray(p) && p.length === 2 && p.every((n) => Number.isInteger(n) && n >= 0 && n <= 30);
}
