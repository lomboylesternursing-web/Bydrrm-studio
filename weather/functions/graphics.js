"use strict";
const fs = require("fs");
const path = require("path");
const MAP = require("./mapData");

let LOGO_B64 = "";
try {
  LOGO_B64 = fs.readFileSync(path.join(__dirname, "assets", "bydrrm-logo.png")).toString("base64");
} catch {}

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
    for (const [level, names] of Object.entries(a.tcwsLevels || {})) if ((names || []).includes(name)) return `TCWS${level}`;
  }
  return "NONE";
}
function warningFill(a, name) {
  const c = classification(a, name);
  const palette = {
    NONE: "#59636b", EXPECTING: "#86BFC5", AFFECTING: "#147dcc",
    YELLOW: "#f2c500", ORANGE: "#e55a00", RED: "#d6251f",
    TCWS1: "#f2c500", TCWS2: "#e55a00", TCWS3: "#d6251f", TCWS4: "#a32488", TCWS5: "#6d28d9"
  };
  return palette[c] || "#59636b";
}

const LABEL_SIZE = {
  "Baliwag": 14, "Bustos": 14, "Pulilan": 14, "Plaridel": 14, "Pandi": 14,
  "Guiguinto": 13, "Balagtas": 13, "Bocaue": 13, "Malolos": 14, "Paombong": 13,
  "Hagonoy": 14, "Bulakan": 13, "Marilao": 13, "Meycauayan": 12, "Obando": 12,
  "Santa Maria": 14, "Angat": 14, "Calumpit": 14, "San Jose del Monte": 14,
  "Doña Remedios Trinidad": 16
};
function labelSvg(name, x, y) {
  const size = LABEL_SIZE[name] || (name.length > 15 ? 15 : 16);
  let lines = [name];
  if (name === "Doña Remedios Trinidad") lines = ["Doña Remedios", "Trinidad"];
  if (name === "San Jose del Monte") lines = ["San Jose del Monte"];
  const firstY = y - (lines.length - 1) * 9;
  return `<text x="${x}" y="${firstY}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${size}" font-weight="800" fill="#ffffff" stroke="#06101a" stroke-width="1.9" paint-order="stroke" stroke-linejoin="round">${lines.map((line, i) => `<tspan x="${x}" dy="${i ? 18 : 0}">${esc(line)}</tspan>`).join("")}</text>`;
}
function mapSvg(a) {
  let shapes = "", labels = "";
  for (const [name, item] of Object.entries(MAP.municipalities)) {
    const fill = warningFill(a, name);
    for (const d of item.paths || []) {
      shapes += `<path d="${d}" fill="${fill}" stroke="#e6edf1" stroke-opacity=".72" stroke-width="0.82" vector-effect="non-scaling-stroke"/>`;
    }
    labels += labelSvg(name, item.label[0], item.label[1]);
  }
  return `<g transform="translate(145 145) scale(.82)">${shapes}${labels}</g>`;
}

function weatherIcon(x, y, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke-linecap="round"><circle cx="22" cy="18" r="11" fill="#e6edf2" stroke="#e6edf2"/><circle cx="36" cy="21" r="14" fill="#e6edf2" stroke="#e6edf2"/><circle cx="50" cy="20" r="10" fill="#e6edf2" stroke="#e6edf2"/><rect x="20" y="18" width="34" height="15" rx="7" fill="#e6edf2" stroke="#e6edf2"/><path d="M24 42l-5 9M37 42l-5 9M50 42l-5 9" stroke="#55aee8" stroke-width="4"/></g>`;
}
function clockIcon(x, y) {
  return `<g transform="translate(${x} ${y})"><circle cx="30" cy="30" r="27" fill="none" stroke="#ffffff" stroke-width="3"/><line x1="30" y1="30" x2="30" y2="13" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/><line x1="30" y1="30" x2="43" y2="38" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/></g>`;
}
function rainBadgeIcon(x, y) {
  return `<g transform="translate(${x} ${y})"><circle cx="22" cy="22" r="20" fill="#0b2235" stroke="#3a8fc8" stroke-width="1.5"/><path d="M12 23h21a7 7 0 0 0-2-13 9 9 0 0 0-17 3 6 6 0 0 0-2 10z" fill="#f0f5f8"/><path d="M16 28l-3 6M23 28l-3 6M30 28l-3 6" stroke="#4fa9e6" stroke-width="2.5" stroke-linecap="round"/></g>`;
}

function rainfallLegend() {
  return `<g transform="translate(28 900)">
    <rect x="0" y="0" width="1024" height="154" rx="16" fill="#091726" fill-opacity=".88" stroke="#6d8496" stroke-opacity=".62"/>
    <text x="230" y="30" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="800" letter-spacing="1.2" fill="#f4f7f9">RAINFALL OUTLOOK</text>
    <text x="770" y="30" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="800" letter-spacing=".6" fill="#f4f7f9">HEAVY RAINFALL WARNING</text>
    <line x1="505" y1="26" x2="505" y2="137" stroke="#8698a7" stroke-opacity=".55"/>

    <g transform="translate(16 42)">
      <rect width="145" height="94" rx="12" fill="#0e2031" stroke="#4b657a"/>
      <rect x="13" y="17" width="35" height="58" rx="6" fill="#59636b"/>
      <text x="59" y="31" font-family="Arial,sans-serif" font-size="16" font-weight="900" fill="#ffffff">NONE</text>
      <text x="59" y="51" font-family="Arial,sans-serif" font-size="11" fill="#becbd4">No rainfall</text>
      <text x="59" y="67" font-family="Arial,sans-serif" font-size="11" fill="#becbd4">to be expected.</text>
    </g>
    <g transform="translate(169 42)">
      <rect width="154" height="94" rx="12" fill="#0e2031" stroke="#4b657a"/>
      <rect x="13" y="17" width="35" height="58" rx="6" fill="#86BFC5"/>
      <text x="59" y="31" font-family="Arial,sans-serif" font-size="15" font-weight="900" fill="#ffffff">EXPECTING</text>
      <text x="59" y="51" font-family="Arial,sans-serif" font-size="11" fill="#becbd4">Rainfall is</text>
      <text x="59" y="67" font-family="Arial,sans-serif" font-size="11" fill="#becbd4">expected.</text>
    </g>
    <g transform="translate(331 42)">
      <rect width="154" height="94" rx="12" fill="#0e2031" stroke="#4b657a"/>
      <rect x="13" y="17" width="35" height="58" rx="6" fill="#147dcc"/>
      <text x="59" y="31" font-family="Arial,sans-serif" font-size="15" font-weight="900" fill="#ffffff">AFFECTING</text>
      <text x="59" y="51" font-family="Arial,sans-serif" font-size="11" fill="#becbd4">Rainfall is</text>
      <text x="59" y="67" font-family="Arial,sans-serif" font-size="11" fill="#becbd4">occurring.</text>
    </g>

    <g transform="translate(525 42)">
      <rect width="151" height="94" rx="12" fill="#0e2031" stroke="#b79829"/>
      <rect width="151" height="34" rx="12" fill="#f2c500"/><rect y="24" width="151" height="10" fill="#f2c500"/>
      <text x="75" y="23" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="900" fill="#ffffff">YELLOW</text>
      <text x="75" y="57" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="800" fill="#ffffff">7.5 - 15</text>
      <text x="75" y="73" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="#d8e0e6">mm/hour</text>
      <text x="75" y="89" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="800" fill="#f2c500">HEAVY</text>
    </g>
    <g transform="translate(684 42)">
      <rect width="151" height="94" rx="12" fill="#0e2031" stroke="#a95726"/>
      <rect width="151" height="34" rx="12" fill="#e55a00"/><rect y="24" width="151" height="10" fill="#e55a00"/>
      <text x="75" y="23" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="900" fill="#ffffff">ORANGE</text>
      <text x="75" y="57" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="800" fill="#ffffff">15 - 30</text>
      <text x="75" y="73" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="#d8e0e6">mm/hour</text>
      <text x="75" y="89" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="800" fill="#f07a35">INTENSE</text>
    </g>
    <g transform="translate(843 42)">
      <rect width="151" height="94" rx="12" fill="#0e2031" stroke="#9d3936"/>
      <rect width="151" height="34" rx="12" fill="#d6251f"/><rect y="24" width="151" height="10" fill="#d6251f"/>
      <text x="75" y="23" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="900" fill="#ffffff">RED</text>
      <text x="75" y="57" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="800" fill="#ffffff">&gt; 30</text>
      <text x="75" y="73" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="#d8e0e6">mm/hour</text>
      <text x="75" y="89" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="800" fill="#e55a56">TORRENTIAL</text>
    </g>
  </g>`;
}

function genericLegend(a) {
  return `<g transform="translate(38 910)"><rect width="1004" height="120" rx="16" fill="#0b1724" fill-opacity=".9" stroke="#52687a" stroke-opacity=".65"/><text x="26" y="42" font-family="Arial,sans-serif" font-size="22" font-weight="800" fill="#ffffff">${esc(a.title || "Official Advisory")}</text><text x="26" y="76" font-family="Arial,sans-serif" font-size="15" fill="#aebdca">Affected Bulacan areas are highlighted on the municipal map.</text><text x="26" y="101" font-family="Arial,sans-serif" font-size="13" fill="#7f93a4">Source: ${esc(a.sourceName || "DOST-PAGASA")}</text></g>`;
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
  const titleSize1 = line1.length > 12 ? 52 : 72;
  const titleSize2 = line2.length > 12 ? 52 : 64;
  const sub = a.type === "heavy_rainfall" && a.warningNo ? `WARNING NO. ${esc(a.warningNo)}` : a.type === "rainfall_advisory" && a.advisoryNo ? `ADVISORY NO. ${esc(a.advisoryNo)}` : "OFFICIAL ADVISORY";
  const logo = LOGO_B64 ? `<image href="data:image/png;base64,${LOGO_B64}" x="866" y="24" width="174" height="148" preserveAspectRatio="xMidYMid meet"/>` : "";
  const sys = systemLines(a.weatherSystem || "");
  const legend = rainfall ? rainfallLegend() : genericLegend(a);

  return `<svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#06111e"/><stop offset=".56" stop-color="#0a1b2b"/><stop offset="1" stop-color="#06121f"/></linearGradient>
      <radialGradient id="glow" cx="17%" cy="48%" r="55%"><stop stop-color="#1e5577" stop-opacity=".2"/><stop offset="1" stop-color="#1e5577" stop-opacity="0"/></radialGradient>
      <pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M44 0H0V44" fill="none" stroke="#7aa4be" stroke-opacity=".035" stroke-width="1"/></pattern>
      <pattern id="rain" width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(17)"><line x1="0" y1="0" x2="0" y2="15" stroke="#c8dae6" stroke-opacity=".035" stroke-width="1"/></pattern>
    </defs>
    <rect width="1080" height="1080" fill="url(#bg)"/>
    <rect width="1080" height="1080" fill="url(#grid)"/>
    <rect width="1080" height="1080" fill="url(#rain)"/>
    <ellipse cx="145" cy="590" rx="420" ry="300" fill="url(#glow)"/>
    <rect x="16" y="16" width="1048" height="1048" rx="18" fill="none" stroke="#9fb2c0" stroke-opacity=".38" stroke-width="0.8"/>

    ${mapSvg(a)}
    ${logo}

    <text x="38" y="50" font-family="Arial,sans-serif" font-size="28" font-weight="300" letter-spacing="5" fill="#e7edf1">BULACAN</text>
    <text x="36" y="120" font-family="Arial,sans-serif" font-size="${titleSize1}" font-weight="900" fill="#ffffff">${esc(line1)}</text>
    <text x="36" y="190" font-family="Arial,sans-serif" font-size="${titleSize2}" font-weight="900" fill="#ffffff">${esc(line2)}</text>

    <g transform="translate(36 208)">
      <rect width="365" height="46" rx="9" fill="#0b2235" fill-opacity=".92" stroke="#287cb6" stroke-opacity=".8"/>
      ${rainBadgeIcon(8, 1)}
      <text x="61" y="30" font-family="Arial,sans-serif" font-size="23" font-weight="800" letter-spacing=".7" fill="#ffffff">${sub}</text>
    </g>

    <g transform="translate(36 272)">
      <rect width="365" height="190" rx="15" fill="#0c1f31" fill-opacity=".88" stroke="#345a73" stroke-opacity=".75"/>
      ${clockIcon(14, 16)}
      <text x="88" y="68" font-family="Arial,sans-serif" font-size="44" font-weight="800" fill="#ffffff">${esc(parts.time)}</text>
      <text x="90" y="98" font-family="Arial,sans-serif" font-size="21" font-weight="700" letter-spacing="1.2" fill="#e5ebef">${esc(parts.date)}</text>
      <line x1="18" y1="116" x2="347" y2="116" stroke="#45677e" stroke-opacity=".55"/>
      ${weatherIcon(22, 126, .75)}
      ${sys.map((line, i) => `<text x="94" y="${146 + i * 24}" font-family="Arial,sans-serif" font-size="${i ? 18 : 20}" font-weight="${i ? 650 : 750}" fill="#f1f5f7">${esc(line)}</text>`).join("")}
    </g>
    <text x="38" y="493" font-family="Arial,sans-serif" font-size="16" fill="#aab9c4">Source: PAGASA (NCR PRSD)</text>

    ${legend}
  </svg>`;
}

module.exports = { graphicSvg, warningFill, rainfallContext, classification };
