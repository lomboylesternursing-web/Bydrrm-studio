const { onRequest } = require("firebase-functions/v2/https");

const RADAR_BOUNDS = {
  north: 22.322581275,
  east: 129.511990464,
  south: 3.80912641587,
  west: 115.969111093
};
const SATELLITE_BOUNDS = {
  north: 30.014531363000003,
  east: 147.02927158600028,
  south: -1.0593208520000024,
  west: 103.99541937000095
};
const ALLOWED_IMAGE_HOSTS = new Set([
  "api.meteopilipinas.gov.ph",
  "src.meteopilipinas.gov.ph",
  "pagasa.dost.gov.ph",
  "www.pagasa.dost.gov.ph",
  "bagong.pagasa.dost.gov.ph",
  "pubfiles.pagasa.dost.gov.ph"
]);

function cors(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("X-Content-Type-Options", "nosniff");
}

async function fetchWithTimeout(url, options = {}, timeout = 15000) {
  return fetch(url, {
    ...options,
    redirect: "follow",
    signal: AbortSignal.timeout(timeout)
  });
}

async function fetchTimeline() {
  const headers = {
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-Requested-With": "XMLHttpRequest",
    "Origin": "https://www.pagasa.dost.gov.ph",
    "Referer": "https://www.pagasa.dost.gov.ph/radar",
    "User-Agent": "Mozilla/5.0 BYDRRM-Weather-Radar/1.0"
  };
  const urls = [
    `https://www.pagasa.dost.gov.ph/api/HybridTimeline?t=${Date.now()}`,
    `https://pagasa.dost.gov.ph/api/HybridTimeline?t=${Date.now()}`
  ];
  let lastError;
  for (const url of urls) {
    try {
      const response = await fetchWithTimeout(url, { method: "POST", headers, body: "" }, 18000);
      if (!response.ok) throw new Error(`PAGASA timeline HTTP ${response.status}`);
      const text = await response.text();
      if (!text.trim()) throw new Error("PAGASA timeline returned an empty body");
      const data = JSON.parse(text);
      return {
        rainfall_estimate: Array.isArray(data.rainfall_estimate) ? data.rainfall_estimate.slice(-12) : [],
        reflectivity: Array.isArray(data.reflectivity) ? data.reflectivity.slice(-12) : []
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("PAGASA timeline unavailable");
}

function normalizeImageUrl(value) {
  const url = new URL(String(value || ""));
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Unsupported image protocol");
  if (!ALLOWED_IMAGE_HOSTS.has(url.hostname.toLowerCase())) throw new Error("Image host is not an approved PAGASA weather source");
  if (url.protocol === "http:") url.protocol = "https:";
  return url.toString();
}

async function pipeImage(res, candidates, cacheSeconds = 180) {
  let lastError;
  for (const rawUrl of candidates) {
    try {
      const url = normalizeImageUrl(rawUrl);
      const response = await fetchWithTimeout(url, {
        headers: {
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "Referer": "https://www.pagasa.dost.gov.ph/",
          "User-Agent": "Mozilla/5.0 BYDRRM-Weather-Radar/1.0"
        }
      }, 18000);
      if (!response.ok) throw new Error(`Image HTTP ${response.status}`);
      const type = response.headers.get("content-type") || "image/png";
      if (!type.toLowerCase().startsWith("image/")) throw new Error(`Unexpected content type ${type}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length) throw new Error("Empty image response");
      res.set("Content-Type", type);
      res.set("Cache-Control", `public,max-age=${cacheSeconds},s-maxage=${cacheSeconds}`);
      const modified = response.headers.get("last-modified");
      if (modified) res.set("X-Source-Last-Modified", modified);
      res.status(200).send(bytes);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Weather image unavailable");
}

function satelliteCandidates(product, frame) {
  if (product === "gk2a") {
    return [
      `https://src.meteopilipinas.gov.ph/repo/gk2a/enhanced-ir/${frame}.png`
    ];
  }
  return [
    `https://src.meteopilipinas.gov.ph/repo/mtsat-colored/24hour/${frame}-him-colored.png`,
    `https://bagong.pagasa.dost.gov.ph/themes/hiraia/assets/images/${frame}-him-colored.png`
  ];
}

exports.pagasaWeatherData = onRequest({
  region: "asia-southeast1",
  timeoutSeconds: 60,
  memory: "256MiB",
  maxInstances: 10
}, async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const action = String(req.query.action || "timeline").toLowerCase();
  try {
    if (action === "timeline") {
      const timeline = await fetchTimeline();
      res.set("Cache-Control", "public,max-age=30,s-maxage=45");
      return res.status(200).json({
        ok: true,
        source: "DOST-PAGASA HybridTimeline",
        fetchedAt: new Date().toISOString(),
        radarBounds: RADAR_BOUNDS,
        satelliteBounds: SATELLITE_BOUNDS,
        ...timeline
      });
    }

    if (action === "image") {
      const sourceUrl = String(req.query.url || "");
      if (!sourceUrl || sourceUrl.length > 1600) return res.status(400).json({ error: "Missing or invalid image URL" });
      await pipeImage(res, [sourceUrl], 180);
      return;
    }

    if (action === "satellite") {
      const frame = Math.min(6, Math.max(1, Number.parseInt(String(req.query.frame || "1"), 10) || 1));
      const product = String(req.query.product || "himawari").toLowerCase() === "gk2a" ? "gk2a" : "himawari";
      await pipeImage(res, satelliteCandidates(product, frame), 240);
      return;
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (error) {
    console.error("pagasaWeatherData", action, error);
    res.set("Cache-Control", "no-store");
    return res.status(502).json({
      error: "Official PAGASA weather source is temporarily unavailable",
      detail: String(error?.message || error).slice(0, 220)
    });
  }
});
