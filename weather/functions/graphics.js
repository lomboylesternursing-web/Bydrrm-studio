"use strict";
const fs = require("fs");
const path = require("path");
const MAP = require("./mapData");
let LOGO_VECTOR = null;
try { LOGO_VECTOR = require("./logoVector"); } catch {}
let LOGO_B64 = "";
try { LOGO_B64 = require("./logoData"); } catch {}
if (!LOGO_B64) {
  try { LOGO_B64 = fs.readFileSync(path.join(__dirname, "assets", "bydrrm-logo.png")).toString("base64"); } catch {}
}

function esc(s = "") {
  return String(s).replace(/[&<>\"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function clean(s = "") {
  return String(s || "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}
function issuedParts(text = "") {
  const s = clean(text);
  const m = s.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))[,\s]+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
  return m ? { time: m[1].toUpperCase(), date: m[2].toUpperCase() } : { time: s || "OFFICIAL UPDATE", date: "" };
}
function systemLines(text = "") {
  const s = clean(text);
  if (!s) return [];
  if (s.length <= 25) return [s];
  const habagat = s.match(/^(.+?)\s*(\(Habagat\))$/i);
  if (habagat) return [habagat[1].trim(), habagat[2]];
  const words = s.split(" ");
  let a = "", b = "";
  for (const w of words) {
    if (!b && (a + " " + w).trim().length <= 24) a = (a + " " + w).trim();
    else b = (b + " " + w).trim();
  }
  return b ? [a, b] : [a];
}

const MUNICIPALITIES = Object.keys(MAP.municipalities);
const ALIASES = {
  "baliuag": "Baliwag", "baliwag": "Baliwag",
  "dona remedios trinidad": "Doña Remedios Trinidad", "doña remedios trinidad": "Doña Remedios Trinidad",
  "city of san jose del monte": "San Jose del Monte", "san jose del monte": "San Jose del Monte",
  "city of malolos": "Malolos", "city of meycauayan": "Meycauayan"
};
function canonical(name = "") {
  const s = clean(name).replace(/^City of /i, "").trim();
  return ALIASES[s.toLowerCase()] || MUNICIPALITIES.find(n => n.toLowerCase() === s.toLowerCase()) || s;
}
function bulacanNamesFromSegment(segment = "") {
  const m = String(segment).match(/Bulacan\s*\(([^)]+)\)/i);
  if (m) return [...new Set(m[1].split(/,|;/).map(canonical).filter(n => MUNICIPALITIES.includes(n)))];
  if (/\bBulacan\b(?!\s*\()/i.test(segment)) return MUNICIPALITIES.slice();
  return [];
}
function rainfallContext(a) {
  if (!["heavy_rainfall", "rainfall_advisory"].includes(a.type)) return { expecting: [], affecting: [] };
  if (a.rainfallContext) return { expecting: a.rainfallContext.expecting || [], affecting: a.rainfallContext.affecting || [] };
  const raw = String(a.rawExcerpt || "");
  let expecting = [], affecting = [];
  const expectOld = raw.match(/(?:Meanwhile,\s*)?expect\s+light\s+to\s+moderate(?:\s+with\s+occasional\s+heavy)?\s+rains?\s+over\s+([\s\S]*?)(?=within\s+the\s+next\s+\d+\s+hours?|Light\s+to\s+moderate(?:\s+with\s+occasional\s+heavy)?\s+rains?\s+(?:are\s+)?affecting|The\s+public|$)/i);
  const expectAdvisory = raw.match(/Light\s+to\s+moderate(?:\s+with\s+occasional\s+heavy)?\s+rains?\s+are\s+expected\s+over\s+([\s\S]*?)(?=Light\s+to\s+moderate(?:\s+with\s+occasional\s+heavy)?\s+rains?\s+(?:are\s+)?affecting|The\s+public|$)/i);
  if (expectOld) expecting = bulacanNamesFromSegment(expectOld[1]);
  else if (expectAdvisory) expecting = bulacanNamesFromSegment(expectAdvisory[1]);
  const affectingMatch = raw.match(/Light\s+to\s+moderate(?:\s+with\s+occasional\s+heavy)?\s+rains?\s+(?:are\s+)?affecting\s+([\s\S]*?)(?=(?:which|and)\s+may\s+(?:persist|affect)|The\s+public|$)/i);
  if (affectingMatch) affecting = bulacanNamesFromSegment(affectingMatch[1]);
  return { expecting, affecting };
}
function classification(a, name) {
  if (["heavy_rainfall", "rainfall_advisory"].includes(a.type)) {
    if ((a.levels?.RED || []).includes(name)) return "RED";
    if ((a.levels?.ORANGE || []).includes(name)) return "ORANGE";
    if ((a.levels?.YELLOW || []).includes(name)) return "YELLOW";
    const ctx = rainfallContext(a);
    if (ctx.affecting.includes(name)) return "AFFECTING";
    if (ctx.expecting.includes(name)) return "EXPECTING";
    return "NONE";
  }
  if (a.type === "thunderstorm") return (a.municipalities || []).includes(name) ? "AFFECTING" : "NONE";
  if (a.type === "tcws") {
    for (const [level, names] of Object.entries(a.tcwsLevels || {})) {
      if ((names || []).includes(name)) return `TCWS${level}`;
    }
  }
  return "NONE";
}
function warningFill(a, name) {
  const palette = {
    NONE: "#a7a9ac", EXPECTING: "#b8d4ec", AFFECTING: "#1978db",
    YELLOW: "#f7b819", ORANGE: "#f57c00", RED: "#d62820",
    TCWS1: "#f7b819", TCWS2: "#f57c00", TCWS3: "#d62820", TCWS4: "#a32488", TCWS5: "#6d28d9"
  };
  return palette[classification(a, name)] || palette.NONE;
}

const LABEL_SIZE = {
  "Baliwag": 19, "Bustos": 19, "Pulilan": 19, "Plaridel": 19, "Pandi": 19,
  "Guiguinto": 18, "Balagtas": 18, "Bocaue": 18, "Malolos": 19, "Paombong": 18,
  "Hagonoy": 19, "Bulakan": 18, "Marilao": 18, "Meycauayan": 17, "Obando": 17,
  "Santa Maria": 19, "Angat": 19, "Calumpit": 19, "San Jose del Monte": 19,
  "Doña Remedios Trinidad": 21, "San Miguel": 21, "San Ildefonso": 20, "San Rafael": 20,
  "Norzagaray": 20
};
function labelSvg(name, x, y) {
  const size = LABEL_SIZE[name] || (name.length > 15 ? 19 : 20);
  return `<text x="${x}" y="${y}" text-anchor="middle" font-family="DejaVu Sans,Arial,sans-serif" font-size="${size}" font-weight="700" fill="#ffffff" stroke="#07111a" stroke-width="2" paint-order="stroke" stroke-linejoin="round" style="text-rendering:geometricPrecision">${esc(name)}</text>`;
}
function mapSvg(a) {
  let shapes = "", labels = "";
  for (const [name, item] of Object.entries(MAP.municipalities)) {
    const fill = warningFill(a, name);
    for (const d of item.paths || []) {
      shapes += `<path d="${d}" fill="${fill}" stroke="#f5f7f8" stroke-opacity=".9" stroke-width=".78" vector-effect="non-scaling-stroke"/>`;
    }
    labels += labelSvg(name, item.label[0], item.label[1]);
  }
  return `<g transform="translate(110 15) scale(.94)">${shapes}${labels}</g>`;
}

function weatherIcon(x, y, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke-linecap="round"><circle cx="22" cy="18" r="11" fill="#f0f3f5" stroke="#f0f3f5"/><circle cx="36" cy="21" r="14" fill="#f0f3f5" stroke="#f0f3f5"/><circle cx="50" cy="20" r="10" fill="#f0f3f5" stroke="#f0f3f5"/><rect x="20" y="18" width="34" height="15" rx="7" fill="#f0f3f5" stroke="#f0f3f5"/><path d="M18 42h33M18 48h27" stroke="#2da7e9" stroke-width="3.3"/></g>`;
}
function clockIcon(x, y) {
  return `<g transform="translate(${x} ${y})"><circle cx="31" cy="31" r="27" fill="none" stroke="#ffffff" stroke-width="3.2"/><line x1="31" y1="31" x2="31" y2="14" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round"/><line x1="31" y1="31" x2="44" y2="39" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round"/></g>`;
}
function rainBadgeIcon(x, y) {
  return `<g transform="translate(${x} ${y})"><circle cx="23" cy="23" r="21" fill="#0b2032" stroke="#1e8ed5" stroke-width="1.8"/><path d="M12 24h22a7 7 0 0 0-2-13 9 9 0 0 0-17 3 6 6 0 0 0-3 10z" fill="#f2f5f7"/><path d="M16 29l-3 7M23 29l-3 7M30 29l-3 7" stroke="#4ca9e6" stroke-width="2.6" stroke-linecap="round"/></g>`;
}
function logoSvg() {
  if (LOGO_VECTOR?.path) {
    return `<g transform="translate(881 19) scale(.255)"><path d="${LOGO_VECTOR.path}" fill="#ffffff" fill-rule="evenodd" clip-rule="evenodd"/></g>`;
  }
  if (LOGO_B64) return `<image href="data:image/png;base64,${LOGO_B64}" x="878" y="18" width="164" height="154" preserveAspectRatio="xMidYMid meet"/>`;
  return "";
}

function rainfallLegend() {
  return `<g transform="translate(24 906)">
    <rect x="0" y="0" width="1032" height="150" rx="14" fill="#081625" fill-opacity=".94" stroke="#7f94a4" stroke-opacity=".62" stroke-width=".9"/>
    <text x="286" y="31" text-anchor="middle" font-family="DejaVu Sans,Arial,sans-serif" font-size="23" font-weight="700" letter-spacing=".8" fill="#f5f7f9">RAINFALL OUTLOOK</text>
    <text x="786" y="31" text-anchor="middle" font-family="DejaVu Sans,Arial,sans-serif" font-size="22" font-weight="700" letter-spacing=".35" fill="#f5f7f9">HEAVY RAINFALL WARNING</text>
    <line x1="540" y1="23" x2="540" y2="134" stroke="#9baab6" stroke-opacity=".62" stroke-width=".9"/>
    <g transform="translate(16 43)"><rect width="158" height="92" rx="10" fill="#0c1c2b" stroke="#435a6c"/><rect x="12" y="16" width="39" height="59" rx="5" fill="#a7a9ac"/><text x="62" y="31" font-family="DejaVu Sans,Arial,sans-serif" font-size="16" font-weight="700" fill="#fff">NONE</text><text x="62" y="52" font-family="DejaVu Sans,Arial,sans-serif" font-size="11" fill="#d4dbe0">No rainfall</text><text x="62" y="68" font-family="DejaVu Sans,Arial,sans-serif" font-size="11" fill="#d4dbe0">to be expected.</text></g>
    <g transform="translate(184 43)"><rect width="168" height="92" rx="10" fill="#0c1c2b" stroke="#435a6c"/><rect x="12" y="16" width="39" height="59" rx="5" fill="#b8d4ec"/><text x="62" y="31" font-family="DejaVu Sans,Arial,sans-serif" font-size="15" font-weight="700" fill="#fff">EXPECTING</text><text x="62" y="52" font-family="DejaVu Sans,Arial,sans-serif" font-size="11" fill="#d4dbe0">Rainfall is</text><text x="62" y="68" font-family="DejaVu Sans,Arial,sans-serif" font-size="11" fill="#d4dbe0">expected.</text></g>
    <g transform="translate(362 43)"><rect width="160" height="92" rx="10" fill="#0c1c2b" stroke="#435a6c"/><rect x="12" y="16" width="39" height="59" rx="5" fill="#1978db"/><text x="62" y="31" font-family="DejaVu Sans,Arial,sans-serif" font-size="15" font-weight="700" fill="#fff">AFFECTING</text><text x="62" y="52" font-family="DejaVu Sans,Arial,sans-serif" font-size="11" fill="#d4dbe0">Rainfall is</text><text x="62" y="68" font-family="DejaVu Sans,Arial,sans-serif" font-size="11" fill="#d4dbe0">occurring.</text></g>
    <g transform="translate(562 43)"><rect width="142" height="92" rx="10" fill="#0c1c2b" stroke="#c49b21"/><rect width="142" height="33" rx="10" fill="#f7b819"/><rect y="23" width="142" height="10" fill="#f7b819"/><text x="71" y="23" text-anchor="middle" font-family="DejaVu Sans,Arial,sans-serif" font-size="18" font-weight="700" fill="#fff">YELLOW</text><text x="71" y="57" text-anchor="middle" font-family="DejaVu Sans,Arial,sans-serif" font-size="14" font-weight="700" fill="#fff">7.5 - 15</text><text x="71" y="73" text-anchor="middle" font-family="DejaVu Sans,Arial,sans-serif" font-size="11" fill="#e5e9ec">mm/hour</text><text x="71" y="89" text-anchor="middle" font-family="DejaVu Sans,Arial,sans-serif" font-size="11" font-weight="700" fill="#fff">HEAVY</text></g>
    <g transform="translate(714 43)"><rect width="142" height="92" rx="10" fill="#0c1c2b" stroke="#b25a22"/><rect width="142" height="33" rx="10" fill="#f57c00"/><rect y="23" width="142" height="10" fill="#f57c00"/><text x="71" y="23" text-anchor="middle" font-family="DejaVu Sans,Arial,sans-serif" font-size="18" font-weight="700" fill="#fff">ORANGE</text><text x="71" y="57" text-anchor="middle" font-family="DejaVu Sans,Arial,sans-serif" font-size="14" font-weight="700" fill="#fff">15 - 30</text><text x="71" y="73" text-anchor="middle" font-family="DejaVu Sans,Arial,sans-serif" font-size="11" fill="#e5e9ec">mm/hour</text><text x="71" y="89" text-anchor="middle" font-family="DejaVu Sans,Arial,sans-serif" font-size="11" font-weight="700" fill="#fff">INTENSE</text></g>
    <g transform="translate(866 43)"><rect width="142" height="92" rx="10" fill="#0c1c2b" stroke="#a33631"/><rect width="142" height="33" rx="10" fill="#d62820"/><rect y="23" width="142" height="10" fill="#d62820"/><text x="71" y="23" text-anchor="middle" font-family="DejaVu Sans,Arial,sans-serif" font-size="18" font-weight="700" fill="#fff">RED</text><text x="71" y="57" text-anchor="middle" font-family="DejaVu Sans,Arial,sans-serif" font-size="14" font-weight="700" fill="#fff">&gt; 30</text><text x="71" y="73" text-anchor="middle" font-family="DejaVu Sans,Arial,sans-serif" font-size="11" fill="#e5e9ec">mm/hour</text><text x="71" y="89" text-anchor="middle" font-family="DejaVu Sans,Arial,sans-serif" font-size="11" font-weight="700" fill="#fff">TORRENTIAL</text></g>
  </g>`;
}
function genericLegend(a) {
  return `<g transform="translate(38 910)"><rect width="1004" height="120" rx="16" fill="#0b1724" fill-opacity=".9" stroke="#52687a" stroke-opacity=".65"/><text x="26" y="42" font-family="DejaVu Sans,Arial,sans-serif" font-size="22" font-weight="700" fill="#ffffff">${esc(a.title || "Official Advisory")}</text><text x="26" y="76" font-family="DejaVu Sans,Arial,sans-serif" font-size="15" fill="#aebdca">Affected Bulacan areas are highlighted on the municipal map.</text><text x="26" y="101" font-family="DejaVu Sans,Arial,sans-serif" font-size="13" fill="#7f93a4">Source: ${esc(a.sourceName || "DOST-PAGASA")}</text></g>`;
}
function titleLines(a) {
  if (a.type === "heavy_rainfall") return ["RAINFALL", "WARNING"];
  if (a.type === "rainfall_advisory") return ["RAINFALL", "ADVISORY"];
  if (a.type === "thunderstorm") return ["THUNDERSTORM", "ADVISORY"];
  if (a.type === "tcws") return ["TROPICAL CYCLONE", "WIND SIGNAL"];
  return ["WEATHER", "ADVISORY"];
}
function graphicSvg(a) {
  const rainfall = ["heavy_rainfall", "rainfall_advisory"].includes(a.type);
  const parts = issuedParts(a.issuedAtText);
  const [line1, line2] = titleLines(a);
  const titleSize1 = line1.length > 12 ? 66 : 108;
  const titleSize2 = line2.length > 12 ? 62 : 92;
  const sub = a.type === "heavy_rainfall" && a.warningNo ? `WARNING NO. ${esc(a.warningNo)}` : a.type === "rainfall_advisory" && a.advisoryNo ? `ADVISORY NO. ${esc(a.advisoryNo)}` : "OFFICIAL ADVISORY";
  const sys = systemLines(a.weatherSystem || "");
  const legend = rainfall ? rainfallLegend() : genericLegend(a);
  return `<svg width="2160" height="2160" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision" text-rendering="geometricPrecision">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#04111f"/><stop offset=".54" stop-color="#092039"/><stop offset="1" stop-color="#061626"/></linearGradient>
      <radialGradient id="glow" cx="18%" cy="47%" r="60%"><stop stop-color="#1b557c" stop-opacity=".18"/><stop offset="1" stop-color="#1b557c" stop-opacity="0"/></radialGradient>
      <pattern id="rain" width="38" height="38" patternUnits="userSpaceOnUse" patternTransform="rotate(17)"><line x1="0" y1="0" x2="0" y2="16" stroke="#d3e1ea" stroke-opacity=".03" stroke-width=".8"/></pattern>
      <filter id="titleShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#000000" flood-opacity=".34"/></filter>
    </defs>
    <rect width="1080" height="1080" fill="url(#bg)"/>
    <rect width="1080" height="1080" fill="url(#rain)"/>
    <ellipse cx="130" cy="620" rx="430" ry="325" fill="url(#glow)"/>
    <rect x="12" y="12" width="1056" height="1056" rx="18" fill="none" stroke="#9db1bf" stroke-opacity=".42" stroke-width=".8"/>
    ${mapSvg(a)}
    ${logoSvg()}
    <text x="30" y="51" font-family="DejaVu Sans,Arial,sans-serif" font-size="29" font-weight="300" letter-spacing="5.2" fill="#f0f2f4">BULACAN</text>
    <line x1="181" y1="43" x2="528" y2="43" stroke="#70879a" stroke-opacity=".66" stroke-width=".9"/>
    <circle cx="530" cy="43" r="2.5" fill="#35b8ff"/>
    <text x="28" y="151" font-family="DejaVu Sans,Arial,sans-serif" font-size="${titleSize1}" font-weight="700" letter-spacing="-2" fill="#ffffff" filter="url(#titleShadow)">${esc(line1)}</text>
    <text x="28" y="231" font-family="DejaVu Sans,Arial,sans-serif" font-size="${titleSize2}" font-weight="700" letter-spacing="-1.2" fill="#ffffff" filter="url(#titleShadow)">${esc(line2)}</text>
    <g transform="translate(28 247)"><rect width="360" height="56" rx="10" fill="#071c2f" fill-opacity=".97" stroke="#1189d0" stroke-opacity=".95" stroke-width="1.15"/>${rainBadgeIcon(8, 5)}<text x="66" y="36" font-family="DejaVu Sans,Arial,sans-serif" font-size="24" font-weight="700" letter-spacing=".4" fill="#ffffff">${sub}</text></g>
    <g transform="translate(28 319)"><rect width="370" height="212" rx="15" fill="#0b1d30" fill-opacity=".91" stroke="#47657a" stroke-opacity=".82" stroke-width=".95"/>${clockIcon(18, 20)}<text x="104" y="72" font-family="DejaVu Sans,Arial,sans-serif" font-size="52" font-weight="700" fill="#ffffff">${esc(parts.time)}</text><text x="104" y="107" font-family="DejaVu Sans,Arial,sans-serif" font-size="22" font-weight="700" letter-spacing=".8" fill="#f0f3f5">${esc(parts.date)}</text><line x1="20" y1="125" x2="350" y2="125" stroke="#425f75" stroke-opacity=".58" stroke-width=".9"/>${weatherIcon(25, 145, .8)}${sys.map((line, i) => `<text x="102" y="${163 + i * 27}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${i ? 19 : 21}" font-weight="700" fill="#f4f6f8">${esc(line)}</text>`).join("")}</g>
    <text x="30" y="557" font-family="DejaVu Sans,Arial,sans-serif" font-size="16" fill="#aeb9c2">Source: PAGASA (NCR PRSD)</text>
    ${legend}
  </svg>`;
}
module.exports = { graphicSvg, warningFill, rainfallContext, classification };
