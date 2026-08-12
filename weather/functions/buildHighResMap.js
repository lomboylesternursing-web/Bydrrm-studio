"use strict";

const fs = require("fs");
const path = require("path");

const SERVICE = "https://ulap-nga.georisk.gov.ph/arcgis/rest/services/PSA/MunicipalPopMF/MapServer/2/query";
const OUTPUT = path.join(__dirname, "mapData.js");

const EXPECTED = [
  "Angat", "Balagtas", "Baliwag", "Bocaue", "Bulakan", "Bustos", "Calumpit",
  "Doña Remedios Trinidad", "Guiguinto", "Hagonoy", "Malolos", "Marilao",
  "Meycauayan", "Norzagaray", "Obando", "Pandi", "Paombong", "Plaridel",
  "Pulilan", "San Ildefonso", "San Jose del Monte", "San Miguel", "San Rafael",
  "Santa Maria"
];

const CANON = new Map(EXPECTED.map(name => [key(name), name]));
CANON.set(key("City of Baliwag"), "Baliwag");
CANON.set(key("City of Malolos"), "Malolos");
CANON.set(key("City of Meycauayan"), "Meycauayan");
CANON.set(key("City of San Jose Del Monte"), "San Jose del Monte");
CANON.set(key("Dona Remedios Trinidad"), "Doña Remedios Trinidad");

// Tiny visual nudges only; geometry remains untouched. These keep labels readable
// in the dense central/southern part of Bulacan.
const LABEL_OFFSETS = {
  "Baliwag": [-3, -8],
  "Bustos": [7, -5],
  "Pulilan": [-8, -4],
  "Plaridel": [-7, 4],
  "Pandi": [7, 3],
  "Guiguinto": [-8, 8],
  "Balagtas": [6, 9],
  "Bocaue": [5, 11],
  "Malolos": [-8, 1],
  "Paombong": [-10, 5],
  "Bulakan": [-2, 10],
  "Marilao": [10, 8],
  "Meycauayan": [12, 11],
  "Obando": [0, 11],
  "Santa Maria": [10, 1],
  "San Jose del Monte": [14, 5]
};

function key(value = "") {
  return String(value)
    .replace(/^City of\s+/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function canonical(value) {
  return CANON.get(key(value)) || null;
}

function ringsFromGeometry(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

function eachCoordinate(geometry, callback) {
  for (const polygon of ringsFromGeometry(geometry)) {
    for (const ring of polygon) {
      for (const coord of ring) callback(coord);
    }
  }
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function fmt(value) {
  const n = round2(value);
  return Number.isInteger(n) ? String(n) : String(n).replace(/0+$/, "").replace(/\.$/, "");
}

async function fetchJson(url, attempts = 3) {
  let last;
  for (let i = 1; i <= attempts; i++) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "BYDRRM-Weather-Map-Builder/1.0" },
        signal: AbortSignal.timeout(30000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      last = error;
      if (i < attempts) await new Promise(resolve => setTimeout(resolve, 1500 * i));
    }
  }
  throw last;
}

function geometryCenter(geometry) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  eachCoordinate(geometry, ([x, y]) => {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  });
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

async function main() {
  const params = new URLSearchParams({
    where: "prov_name='BULACAN'",
    outFields: "city_name,city_code,psgc_10d,prov_name,centroid_x,centriod_y",
    returnGeometry: "true",
    outSR: "4326",
    geometryPrecision: "6",
    resultRecordCount: "100",
    f: "geojson"
  });
  const url = `${SERVICE}?${params}`;
  console.log("Fetching PSA Municipal Boundary geometry for Bulacan...");
  const geojson = await fetchJson(url);
  if (geojson?.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
    throw new Error("PSA service did not return a GeoJSON FeatureCollection.");
  }

  const byName = new Map();
  for (const feature of geojson.features) {
    const name = canonical(feature?.properties?.city_name);
    if (!name || !feature?.geometry) continue;
    if (byName.has(name)) throw new Error(`Duplicate municipal feature: ${name}`);
    byName.set(name, feature);
  }

  const missing = EXPECTED.filter(name => !byName.has(name));
  const extras = [...byName.keys()].filter(name => !EXPECTED.includes(name));
  if (missing.length || extras.length || byName.size !== 24) {
    throw new Error(`Expected 24 Bulacan LGUs; got ${byName.size}. Missing: ${missing.join(", ") || "none"}; extra: ${extras.join(", ") || "none"}`);
  }

  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const feature of byName.values()) {
    eachCoordinate(feature.geometry, ([lon, lat]) => {
      minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    });
  }

  // Equirectangular projection with longitude corrected for Bulacan latitude.
  const midLat = (minLat + maxLat) / 2;
  const cosLat = Math.cos(midLat * Math.PI / 180);
  const minGX = minLon * cosLat;
  const maxGX = maxLon * cosLat;
  const minGY = -maxLat;
  const maxGY = -minLat;

  // Local coordinate box chosen to preserve the approved live composition.
  // graphics.js applies translate(95 10) scale(.97) after this.
  const BOX = { x: 58, y: 262, w: 700, h: 612 };
  const sx = BOX.w / (maxGX - minGX);
  const sy = BOX.h / (maxGY - minGY);
  const scale = Math.min(sx, sy);
  const usedW = (maxGX - minGX) * scale;
  const usedH = (maxGY - minGY) * scale;
  const ox = BOX.x + (BOX.w - usedW) / 2;
  const oy = BOX.y + (BOX.h - usedH) / 2;

  function project([lon, lat]) {
    return [
      ox + (lon * cosLat - minGX) * scale,
      oy + (-lat - minGY) * scale
    ];
  }

  function ringPath(ring) {
    if (!Array.isArray(ring) || ring.length < 3) return "";
    const points = [];
    let last = null;
    for (const coord of ring) {
      const p = project(coord);
      const rounded = [round2(p[0]), round2(p[1])];
      if (!last || rounded[0] !== last[0] || rounded[1] !== last[1]) {
        points.push(rounded);
        last = rounded;
      }
    }
    if (points.length < 3) return "";
    return `M${fmt(points[0][0])} ${fmt(points[0][1])}` +
      points.slice(1).map(p => `L${fmt(p[0])} ${fmt(p[1])}`).join("") + "Z";
  }

  const municipalities = {};
  for (const name of EXPECTED) {
    const feature = byName.get(name);
    const paths = [];
    for (const polygon of ringsFromGeometry(feature.geometry)) {
      const d = polygon.map(ringPath).filter(Boolean).join("");
      if (d) paths.push(d);
    }
    if (!paths.length) throw new Error(`No valid polygon paths for ${name}`);

    let center;
    const cx = Number(feature.properties?.centroid_x);
    const cy = Number(feature.properties?.centriod_y);
    if (Number.isFinite(cx) && Number.isFinite(cy)) center = project([cx, cy]);
    else center = project(geometryCenter(feature.geometry));

    const [dx, dy] = LABEL_OFFSETS[name] || [0, 0];
    municipalities[name] = {
      psgc: String(feature.properties?.psgc_10d || feature.properties?.city_code || ""),
      paths,
      label: [round2(center[0] + dx), round2(center[1] + dy)]
    };
  }

  const output = {
    source: "PSA Municipal Boundary feature service (GeoRisk Philippines)",
    sourceLayer: SERVICE.replace(/\/query$/, ""),
    generatedFromPSA: true,
    municipalities
  };
  fs.writeFileSync(OUTPUT, `"use strict";\nmodule.exports = ${JSON.stringify(output)};\n`);
  console.log(`Generated high-resolution Bulacan map: ${Object.keys(municipalities).length} LGUs -> ${OUTPUT}`);
}

main().catch(error => {
  console.error("High-resolution Bulacan map build failed:", error?.stack || error);
  process.exit(1);
});
