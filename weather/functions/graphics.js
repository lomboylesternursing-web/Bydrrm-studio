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
    NONE: "#4b5358", EXPECTING: "#d8dde1", AFFECTING: "#0c79c9",
    YELLOW: "#f2c500", ORANGE: "#e55a00", RED: "#d6251f",
    TCWS1: "#f2c500", TCWS2: "#e55a00", TCWS3: "#d6251f", TCWS4: "#a32488", TCWS5: "#6d28d9"
  };
  return palette[c] || "#4b5358";
}

function labelSvg(name, x, y) {
  let lines = [name], size = 19;
  if (name === "Doña Remedios Trinidad") { lines = ["Doña Remedios Trinidad"]; size = 18; }
  else if (name === "San Jose del Monte") { lines = ["San Jose del Monte"]; size = 17; }
  else if (name.length > 15) size = 17;
  return `<text x="${x}" y="${y}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${size}" font-weight="700" fill="#ffffff" stroke="#09111a" stroke-width="3.6" paint-order="stroke" stroke-linejoin="round">${lines.map((line, i) => `<tspan x="${x}" dy="${i ? 20 : 0}">${esc(line)}</tspan>`).join("")}</text>`;
}
function mapSvg(a) {
  let shapes = "", labels = "";
  for (const [name, item] of Object.entries(MAP.municipalities)) {
    const fill = warningFill(a, name);
    for (const d of item.paths || []) {
      shapes += `<path d="${d}" fill="${fill}" stroke="#d7d9dc" stroke-opacity=".95" stroke-width="1.45" vector-effect="non-scaling-stroke"/>`;
    }
    labels += labelSvg(name, item.label[0], item.label[1]);
  }
  return `<g transform="translate(145 145) scale(.82)">${shapes}${labels}</g>`;
}

function rainfallLegend() {
  return `<g transform="translate(28 892)">
    <text x="165" y="0" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" font-weight="700" fill="#ffffff">EXPECTING</text>
    <text x="335" y="0" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" font-weight="700" fill="#ffffff">AFFECTING</text>
    <rect x="0" y="10" width="112" height="25" fill="#4b5358" stroke="#8f969c" stroke-width="1"/>
    <rect x="118" y="10" width="164" height="25" fill="#d8dde1" stroke="#ffffff" stroke-opacity=".75"/>
    <rect x="288" y="10" width="135" height="25" fill="#0c79c9" stroke="#5eb2ed" stroke-opacity=".65"/>
    <text x="54" y="68" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="800" fill="#ffffff">NONE</text>
    <text x="225" y="68" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="800" fill="#ffffff">LIGHT - MODERATE</text>
    <text x="225" y="92" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" fill="#eef3f7">TO AT TIMES HEAVY RAINS</text>

    <g transform="translate(500 0)">
      <text x="255" y="0" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff">HEAVY RAINFALL WARNING</text>
      <rect x="0" y="10" width="155" height="25" fill="#f2c500"/>
      <rect x="161" y="10" width="155" height="25" fill="#e55a00"/>
      <rect x="322" y="10" width="155" height="25" fill="#d6251f"/>
      <text x="78" y="28" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="#ffffff">7.5 - 15 mm/hour</text>
      <text x="239" y="28" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="#ffffff">15 - 30 mm/hour</text>
      <text x="400" y="28" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="#ffffff">Higit 30 mm/hour</text>
      <text x="78" y="68" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" font-weight="800" fill="#ffffff">YELLOW</text>
      <text x="239" y="68" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" font-weight="800" fill="#ffffff">ORANGE</text>
      <text x="400" y="68" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" font-weight="800" fill="#ffffff">RED</text>
      <rect x="0" y="76" width="155" height="22" fill="#4a4b4c"/><rect x="161" y="76" width="155" height="22" fill="#4a4b4c"/><rect x="322" y="76" width="155" height="22" fill="#4a4b4c"/>
      <text x="78" y="92" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#ffffff">HEAVY</text>
      <text x="239" y="92" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#ffffff">INTENSE</text>
      <text x="400" y="92" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#ffffff">TORRENTIAL</text>
    </g>
  </g>`;
}

function genericLegend(a) {
  return `<g transform="translate(38 905)"><rect width="1004" height="110" rx="14" fill="#0b1724" fill-opacity=".9" stroke="#52687a" stroke-opacity=".65"/><text x="26" y="38" font-family="Arial,sans-serif" font-size="22" font-weight="800" fill="#ffffff">${esc(a.title || "Official Advisory")}</text><text x="26" y="70" font-family="Arial,sans-serif" font-size="15" fill="#aebdca">Affected Bulacan areas are highlighted on the municipal map.</text><text x="26" y="94" font-family="Arial,sans-serif" font-size="13" fill="#7f93a4">Source: ${esc(a.sourceName || "DOST-PAGASA")}</text></g>`;
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
  const titleSize1 = line1.length > 12 ? 54 : 72;
  const titleSize2 = line2.length > 12 ? 54 : 66;
  const sub = a.type === "heavy_rainfall" && a.warningNo ? `WARNING NO. ${esc(a.warningNo)}` : a.type === "rainfall_advisory" && a.advisoryNo ? `ADVISORY NO. ${esc(a.advisoryNo)}` : "";
  const logo = LOGO_B64 ? `<image href="data:image/png;base64,${LOGO_B64}" x="865" y="30" width="175" height="150" preserveAspectRatio="xMidYMid meet"/>` : "";
  const system = esc(a.weatherSystem || "");
  const legend = rainfall ? rainfallLegend() : genericLegend(a);

  return `<svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#07101d"/><stop offset=".58" stop-color="#0a1625"/><stop offset="1" stop-color="#07121e"/></linearGradient>
      <radialGradient id="cloud" cx="20%" cy="62%" r="58%"><stop stop-color="#24445c" stop-opacity=".34"/><stop offset="1" stop-color="#24445c" stop-opacity="0"/></radialGradient>
      <pattern id="rain" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(17)"><line x1="0" y1="0" x2="0" y2="13" stroke="#b7cfdf" stroke-opacity=".035" stroke-width="1"/></pattern>
    </defs>
    <rect width="1080" height="1080" fill="url(#bg)"/>
    <rect width="1080" height="1080" fill="url(#rain)"/>
    <ellipse cx="150" cy="660" rx="430" ry="255" fill="url(#cloud)"/>
    <rect x="16" y="16" width="1048" height="1048" rx="18" fill="none" stroke="#a7b7c2" stroke-opacity=".45" stroke-width="1.2"/>

    ${logo}
    <text x="42" y="52" font-family="Arial,sans-serif" font-size="30" font-weight="300" letter-spacing="2.2" fill="#e8edf1">BULACAN</text>
    <text x="40" y="128" font-family="Arial,sans-serif" font-size="${titleSize1}" font-weight="900" fill="#ffffff">${esc(line1)}</text>
    <text x="40" y="202" font-family="Arial,sans-serif" font-size="${titleSize2}" font-weight="900" fill="#ffffff">${esc(line2)}</text>
    ${sub ? `<text x="42" y="232" font-family="Arial,sans-serif" font-size="15" font-weight="700" letter-spacing="2" fill="#9aaebe">${sub}</text>` : ""}

    <g transform="translate(0 240)">
      <rect x="0" y="0" width="410" height="118" fill="#8f98a3" fill-opacity=".18" stroke="#8ba1b1" stroke-opacity=".34"/>
      <circle cx="62" cy="48" r="27" fill="none" stroke="#ffffff" stroke-width="3"/>
      <line x1="62" y1="48" x2="62" y2="31" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/><line x1="62" y1="48" x2="74" y2="55" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
      <text x="108" y="60" font-family="Arial,sans-serif" font-size="44" font-weight="700" fill="#ffffff">${esc(parts.time)}</text>
      <text x="108" y="94" font-family="Arial,sans-serif" font-size="23" font-weight="600" letter-spacing="1.4" fill="#eef2f5">${esc(parts.date)}</text>
    </g>
    <text x="28" y="388" font-family="Arial,sans-serif" font-size="16" fill="#b7c2ca">Source: PAGASA (NCR PRSD)</text>
    ${system ? `<text x="28" y="416" font-family="Arial,sans-serif" font-size="14" fill="#7f93a4">${system}</text>` : ""}

    ${mapSvg(a)}
    ${legend}
  </svg>`;
}

module.exports = { graphicSvg, warningFill, rainfallContext, classification };
