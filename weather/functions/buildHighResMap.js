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
CANON.set(key("Baliuag"), "Baliwag");
CANON.set(key("City of Baliuag"), "Baliwag");
CANON.set(key("City of Baliwag"), "Baliwag");
CANON.set(key("Bulacan"), "Bulakan");
CANON.set(key("City of Malolos"), "Malolos");
CANON.set(key("City of Meycauayan"), "Meycauayan");
CANON.set(key("City of San Jose Del Monte"), "San Jose del Monte");
CANON.set(key("Dona Remedios Trinidad"), "Doña Remedios Trinidad");

// Manual label nudges only. These do not alter any PSA municipal geometry.
// The dense central/southern municipalities need separate visual centering
// for a social-media graphic rather than strict polygon-bounds centering.
const LABEL_OFFSETS = {
  "Baliwag": [-8, -12],
  "Bustos": [7, -8],
  "Pulilan": [-12, -6],
  "Plaridel": [-11, 2],
  "Pandi": [9, 0],
  "Guiguinto": [4, 3],
  "Balagtas": [10, 12],
  "Bocaue": [8, 16],
  "Malolos": [-17, -3],
  "Paombong": [-16, 9],
  "Hagonoy": [-8, -2],
  "Bulakan": [-12, 14],
  "Marilao": [13, 5],
  "Meycauayan": [17, 15],
  "Obando": [-4, 17],
  "Santa Maria": [15, -3],
  "San Jose del Monte": [18, 8],
  "Calumpit": [-8, 0],
  "Angat": [5, -5]
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

function prop(properties, wanted) {
  if (!properties) return undefined;
  if (Object.prototype.hasOwnProperty.call(properties, wanted)) return properties[wanted];
  const target = wanted.toLowerCase();
  const found = Object.keys(properties).find(k => k.toLowerCase() === target);
  return found ? properties[found] : undefined;
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
    where: "prov_name='Bulacan' OR prov_name='BULACAN'",
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
  console.log(`PSA returned ${geojson.features.length} feature(s).`);
  if (geojson.features[0]?.properties) {
    console.log("PSA property keys:", Object.keys(geojson.features[0].properties).join(", "));
  }

  const byName = new Map();
  for (const feature of geojson.features) {
    const rawName = prop(feature?.properties, "city_name");
    const name = canonical(rawName);
    if (!name || !feature?.geometry) continue;
    if (byName.has(name)) throw new Error(`Duplicate municipal feature: ${name}`);
    byName.set(name, feature);
  }

  const missing = EXPECTED.filter(name => !byName.has(name));
  const extras = [...byName.keys()].filter(name => !EXPECTED.includes(name));
  if (missing.length || extras.length || byName.size !== 24) {
    const samples = geojson.features.slice(0, 8).map(f => String(prop(f?.properties, "city_name") || "(no city_name)")).join(" | ");
    throw new Error(`Expected 24 Bulacan LGUs; got ${byName.size}. Missing: ${missing.join(", ") || "none"}; extra: ${extras.join(", ") || "none"}; sample names: ${samples}`);
  }

  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const feature of byName.values()) {
    eachCoordinate(feature.geometry, ([lon, lat]) => {
      minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    });
  }

  const midLat = (minLat + maxLat) / 2;
  const cosLat = Math.cos(midLat * Math.PI / 180);
  const minGX = minLon * cosLat;
  const maxGX = maxLon * cosLat;
  const minGY = -maxLat;
  const maxGY = -minLat;

  // Keep the approved-layout map scale exactly the same. This position balances
  // the dominant map footprint without letting it crowd the title/info panel.
  // graphics.js applies translate(95 10) scale(.97) after these local coordinates.
  const BOX = { x: 112, y: 90, w: 880, h: 760 };
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
    const cx = Number(prop(feature.properties, "centroid_x"));
    const cy = Number(prop(feature.properties, "centriod_y"));
    if (Number.isFinite(cx) && Number.isFinite(cy)) center = project([cx, cy]);
    else center = project(geometryCenter(feature.geometry));

    const [dx, dy] = LABEL_OFFSETS[name] || [0, 0];
    municipalities[name] = {
      psgc: String(prop(feature.properties, "psgc_10d") || prop(feature.properties, "city_code") || ""),
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
