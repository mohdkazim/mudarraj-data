/**
 * Squads (27 Oct 2026, Mohamed: "add the squad before each match and also in each teams page" → full squads).
 *
 *   data/squads/<team id>.json   one club's current squad, with the page(s) it was copied from
 *   dist/squads.json             every squad, for the site (built by tools/build.mjs; changes only when a squad does)
 *
 * A "squad" change copies a club's list as a trusted page shows it (365Scores' squad page in English, and its
 * Arabic version for the Arabic names; see RUNBOOK.md "Squads"). Positions and nationalities may be given as the
 * page writes them ("Centre Back", "Ivory Coast"): they are turned into codes here (DF/CB, CI), and anything
 * unknown is reported instead of guessed.
 */
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { DATA, readJSON, writeJSON } from "./lib.mjs";

export const SQUADS = path.join(DATA, "squads");
export const squadFile = (team) => path.join(SQUADS, `${team}.json`);

/** Position groups shown on the site, and the detailed roles each page position becomes. */
export const GROUPS = ["GK", "DF", "MF", "FW"];
export const ROLES = {
  GK: "GK",
  RB: "DF", CB: "DF", LB: "DF", RWB: "DF", LWB: "DF",
  DM: "MF", CM: "MF", AM: "MF", RM: "MF", LM: "MF",
  RW: "FW", LW: "FW", RF: "FW", LF: "FW", CF: "FW", SS: "FW",
};

const fold = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’'`.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Page wording → [group, role]. */
const POSITION_WORDS = {
  goalkeeper: ["GK", "GK"], keeper: ["GK", "GK"], gk: ["GK", "GK"],
  defender: ["DF", null], "right back": ["DF", "RB"], "left back": ["DF", "LB"], "centre back": ["DF", "CB"], "center back": ["DF", "CB"],
  "central defender": ["DF", "CB"], "right wing back": ["DF", "RWB"], "left wing back": ["DF", "LWB"], "right wingback": ["DF", "RWB"], "left wingback": ["DF", "LWB"],
  midfielder: ["MF", null], midfield: ["MF", null], "defensive midfield": ["MF", "DM"], "defensive midfielder": ["MF", "DM"],
  "central midfield": ["MF", "CM"], "central midfielder": ["MF", "CM"], "centre midfield": ["MF", "CM"], "center midfield": ["MF", "CM"],
  "attacking midfield": ["MF", "AM"], "attacking midfielder": ["MF", "AM"], "right midfield": ["MF", "RM"], "left midfield": ["MF", "LM"],
  "right midfielder": ["MF", "RM"], "left midfielder": ["MF", "LM"],
  forward: ["FW", null], attacker: ["FW", null], striker: ["FW", "CF"], "centre forward": ["FW", "CF"], "center forward": ["FW", "CF"],
  "right forward": ["FW", "RF"], "left forward": ["FW", "LF"], "right winger": ["FW", "RW"], "left winger": ["FW", "LW"], "right wing": ["FW", "RW"], "left wing": ["FW", "LW"],
  "second striker": ["FW", "SS"], "secondary striker": ["FW", "SS"], winger: ["FW", null],
  // FotMob's squad page: headings and position codes
  keepers: ["GK", "GK"], defenders: ["DF", null], midfielders: ["MF", null], forwards: ["FW", null],
  st: ["FW", "CF"], cf: ["FW", "CF"], ss: ["FW", "SS"],
};

/**
 * Sites a squad may be copied from besides the result sources (Tier 1/2, "enough alone"): reputable football data
 * apps whose squad pages list every player with number, position and nationality. Squads only, never results.
 * FotMob (27 Oct 2026): its squad pages open reliably when 365Scores' fail.
 */
export const SQUAD_SITES = ["fotmob.com"];
export const squadSiteOk = (url) => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return SQUAD_SITES.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
};

/** "Centre Back" | "DF" | "CB" → { pos: "DF", role: "CB" }, or null when unknown. */
export function position(p) {
  if (typeof p !== "string" || !p.trim()) return null;
  const raw = p.trim();
  if (GROUPS.includes(raw)) return { pos: raw, role: raw === "GK" ? "GK" : null };
  if (ROLES[raw]) return { pos: ROLES[raw], role: raw };
  const hit = POSITION_WORDS[fold(raw)];
  return hit ? { pos: hit[0], role: hit[1] } : null;
}

// ---- nationalities ----------------------------------------------------------------------------

/** UK nations play as countries; football writes them by name. */
const SPECIAL = { england: "GB-ENG", scotland: "GB-SCT", wales: "GB-WLS", "northern ireland": "GB-NIR", kosovo: "XK" };
/** How football pages write some countries (after fold()). */
const ALIASES = {
  turkiye: "TR", turkey: "TR", "ivory coast": "CI", "cote divoire": "CI", "korea republic": "KR", "south korea": "KR", "republic of korea": "KR", "korea south": "KR",
  "north korea": "KP", "korea dpr": "KP", usa: "US", "united states": "US", "united states of america": "US", "dr congo": "CD", "congo dr": "CD",
  "democratic republic of the congo": "CD", "democratic republic of congo": "CD", "congo kinshasa": "CD", congo: "CG", "republic of the congo": "CG", "congo brazzaville": "CG",
  "czech republic": "CZ", czechia: "CZ", "bosnia and herzegovina": "BA", "bosnia herzegovina": "BA", "cape verde": "CV", "cabo verde": "CV", "cape verde islands": "CV",
  "north macedonia": "MK", macedonia: "MK", "republic of ireland": "IE", ireland: "IE", curacao: "CW", iran: "IR", "ir iran": "IR", syria: "SY", russia: "RU",
  palestine: "PS", vietnam: "VN", "viet nam": "VN", laos: "LA", brunei: "BN", "hong kong": "HK", "hong kong china": "HK", macau: "MO", macao: "MO", "chinese taipei": "TW", taiwan: "TW",
  gambia: "GM", "the gambia": "GM", eswatini: "SZ", swaziland: "SZ", tanzania: "TZ", moldova: "MD", bolivia: "BO", venezuela: "VE", "trinidad and tobago": "TT",
  "antigua and barbuda": "AG", "saint kitts and nevis": "KN", "st kitts and nevis": "KN", "saint lucia": "LC", "st lucia": "LC", "saint vincent and the grenadines": "VC",
  "guinea bissau": "GW", "sao tome and principe": "ST", "central african republic": "CF", uae: "AE", "united arab emirates": "AE", "saudi arabia": "SA", "kyrgyz republic": "KG",
  kyrgyzstan: "KG", "china pr": "CN", china: "CN", "myanmar": "MM", burma: "MM", "east timor": "TL", "timor leste": "TL", "the netherlands": "NL", holland: "NL",
  "great britain": "GB", "united kingdom": "GB", "st martin": "MF", "guadeloupe": "GP", martinique: "MQ", "french guiana": "GF", reunion: "RE", "new caledonia": "NC",
  "equatorial guinea": "GQ", "south sudan": "SS", "libya": "LY", "sudan": "SD", "micronesia": "FM", "faroe islands": "FO", "u s virgin islands": "VI", "us virgin islands": "VI",
};

/** Region codes that aren't countries a player plays for (groupings, old or reserved codes). */
const NOT_COUNTRIES = new Set(["EU", "UN", "EZ", "ZZ", "AN", "BU", "CS", "DD", "FX", "NT", "SU", "TP", "YD", "YU", "ZR", "AC", "CP", "DG", "EA", "IC", "TA", "AQ", "BV", "HM", "UM"]);

let byName = null;
/** Every region name ICU knows in English (Node ships full ICU), folded → code, plus the aliases above. */
function names() {
  if (byName) return byName;
  byName = new Map();
  const dn = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (const a of A)
    for (const b of A) {
      const code = a + b;
      if (NOT_COUNTRIES.has(code) || code.startsWith("X") || code.startsWith("Q")) continue;
      const n = dn.of(code);
      if (!n || n === code) continue;
      if (!byName.has(fold(n))) byName.set(fold(n), code);
      // "Congo - Kinshasa", "Myanmar (Burma)", "Hong Kong SAR China": also the part before the dash/bracket
      const short = n.split(/ - | \(|,/)[0];
      if (short !== n && !byName.has(fold(short))) byName.set(fold(short), code);
    }
  for (const [k, v] of Object.entries(ALIASES)) byName.set(k, v);
  for (const [k, v] of Object.entries(SPECIAL)) byName.set(k, v);
  return byName;
}

export const NAT_CODE = /^([A-Z]{2}|GB-(ENG|SCT|WLS|NIR))$/;

/** "Ivory Coast" | "CI" | "England" → "CI" | "GB-ENG"; null when unknown. */
export function nationality(n) {
  if (typeof n !== "string" || !n.trim()) return null;
  const raw = n.trim();
  if (NAT_CODE.test(raw)) return raw;
  return names().get(fold(raw)) ?? null;
}

// ---- players ----------------------------------------------------------------------------------

const ARABIC = /[؀-ۿ]/;
const LATIN_NAME = /^[^؀-ۿ]{2,80}$/;

/**
 * A squad as a change gives it → { players, problems }. `players` is null when the list can't be used
 * (too short, a player without a name or position); problems also lists details that were left out
 * (an unknown nationality, an Arabic name that isn't Arabic, a repeated shirt number).
 */
export function normSquad(list) {
  const problems = [];
  if (!Array.isArray(list)) return { players: null, problems: ["players must be a list"] };
  if (list.length < 11 || list.length > 80) return { players: null, problems: [`a squad has 11 to 80 players (got ${list.length})`] };
  const players = [];
  for (const [i, p] of list.entries()) {
    const at = `player ${i + 1}`;
    const name = typeof p?.name === "string" ? p.name.trim().replace(/\s+/g, " ") : "";
    if (!LATIN_NAME.test(name)) return { players: null, problems: [`${at}: needs a name as the page writes it (Latin letters)`] };
    const pos = position(p.pos ?? p.position);
    if (!pos) return { players: null, problems: [`${at} (${name}): unknown position ${JSON.stringify(p.pos ?? p.position)} — add the wording to tools/squads.mjs if it is real`] };
    const out = { n: null, name };
    const n = p.n ?? p.number ?? null;
    if (n !== null && n !== "-" && n !== "") {
      const num = Number(n);
      if (Number.isInteger(num) && num >= 0 && num <= 99) out.n = num;
      else problems.push(`${name}: shirt number ${JSON.stringify(n)} left out`);
    }
    const ar = typeof p.ar === "string" ? p.ar.trim().replace(/\s+/g, " ") : "";
    if (ar) {
      if (ARABIC.test(ar) && ar.length <= 80) out.ar = ar;
      else problems.push(`${name}: Arabic name ${JSON.stringify(ar)} left out (not Arabic)`);
    }
    out.pos = pos.pos;
    if (pos.role && pos.role !== pos.pos) out.role = pos.role;
    // A finer position given separately (FotMob: heading "Defenders", position "RB"): kept when it fits the group.
    if (p.role) {
      const r = position(String(p.role).split(/[,/]/)[0]);
      if (r && r.pos === out.pos && r.role && r.role !== r.pos) out.role = r.role;
    }
    const natIn = p.nat ?? p.nationality ?? null;
    if (natIn) {
      const nat = nationality(natIn);
      if (nat) out.nat = nat;
      else problems.push(`${name}: unknown nationality ${JSON.stringify(natIn)} left out — add it to tools/squads.mjs ALIASES if it is real`);
    }
    players.push(out);
  }
  const seen = new Map();
  for (const p of players) if (p.n !== null) seen.set(p.n, (seen.get(p.n) ?? 0) + 1);
  const twice = [...seen].filter(([, k]) => k > 1).map(([n]) => n);
  if (twice.length) problems.push(`shirt number(s) used twice: ${twice.join(", ")} (as the page lists them)`);
  return { players: sortPlayers(players), problems };
}

/** A player as stored in data/squads (codes, not page wording): the problem, or null. */
export function storedPlayerProblem(p) {
  if (!p || typeof p !== "object") return "not an object";
  if (!LATIN_NAME.test(p.name ?? "")) return "name missing or not in Latin letters";
  if (p.n !== null && !(Number.isInteger(p.n) && p.n >= 0 && p.n <= 99)) return `bad shirt number ${p.n}`;
  if (!GROUPS.includes(p.pos)) return `bad position ${p.pos}`;
  if (p.role !== undefined && ROLES[p.role] !== p.pos) return `role ${p.role} doesn't fit position ${p.pos}`;
  if (p.nat !== undefined && !NAT_CODE.test(p.nat)) return `bad nationality code ${p.nat}`;
  if (p.ar !== undefined && !(typeof p.ar === "string" && ARABIC.test(p.ar))) return "Arabic name isn't Arabic";
  const extra = Object.keys(p).filter((k) => !["n", "name", "ar", "pos", "role", "nat"].includes(k));
  if (extra.length) return `unknown field(s) ${extra.join(", ")}`;
  return null;
}

/** Same players (shirt numbers, names, positions, nationalities, Arabic names)? */
export const sameSquad = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function loadSquads() {
  const out = new Map();
  if (!existsSync(SQUADS)) return out;
  for (const f of readdirSync(SQUADS)) if (f.endsWith(".json")) out.set(f.slice(0, -5), readJSON(path.join(SQUADS, f)));
  return out;
}

export const saveSquad = (squad) => writeJSON(squadFile(squad.team), squad);

/** Group order on the site: goalkeepers, defenders, midfielders, forwards; then shirt number. */
export function sortPlayers(players) {
  return [...players].sort((a, b) => GROUPS.indexOf(a.pos) - GROUPS.indexOf(b.pos) || (a.n ?? 999) - (b.n ?? 999) || a.name.localeCompare(b.name));
}

/** Squads are rechecked every 30 days, and every 7 during transfer windows (when they really change). */
export function squadMaxAgeDays(now = Date.now()) {
  const d = new Date(now + 4 * 3600_000); // Dubai date
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const window = m === 1 || (m === 2 && day <= 3) || (m === 6 && day >= 15) || m === 7 || m === 8 || (m === 9 && day <= 15);
  return window ? 7 : 30;
}
