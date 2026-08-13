const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const cheerio = require("cheerio");
const sharp = require("sharp");
const crypto = require("crypto");
const GRAPHICS = require("./graphics");

admin.initializeApp();
const db = admin.firestore();
const META_PAGE_ACCESS_TOKEN = defineSecret("META_PAGE_ACCESS_TOKEN");
const META_PAGE_ID = defineSecret("META_PAGE_ID");

const NCR_URL = "https://www.pagasa.dost.gov.ph/regional-forecast/ncrprsd";
const TC_URL = "https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin";
const BULACAN = [
  "Angat", "Balagtas", "Baliwag", "Bocaue", "Bulakan", "Bustos", "Calumpit",
  "Doña Remedios Trinidad", "Guiguinto", "Hagonoy", "Malolos", "Marilao",
  "Meycauayan", "Norzagaray", "Obando", "Pandi", "Paombong", "Plaridel",
  "Pulilan", "San Ildefonso", "San Jose del Monte", "San Miguel", "San Rafael",
  "Santa Maria"
];
const ALIASES = {
  "dona remedios trinidad": "Doña Remedios Trinidad",
  "doña remedios trinidad": "Doña Remedios Trinidad",
  "baliuag": "Baliwag",
  "baliwag": "Baliwag",
  "city of san jose del monte": "San Jose del Monte",
  "san jose del monte": "San Jose del Monte",
  "city of malolos": "Malolos",
  "malolos": "Malolos",
  "city of meycauayan": "Meycauayan",
  "meycauayan": "Meycauayan"
};

function clean(s = "") {
  return s.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}
function canonical(n) {
  const s = clean(n).replace(/^City of /i, "").trim();
  return ALIASES[s.toLowerCase()] || BULACAN.find(x => x.toLowerCase() === s.toLowerCase()) || s;
}
function list(s) {
  return clean(s).split(/,|;/).map(canonical).map(x => x.trim()).filter(x => BULACAN.includes(x));
}
function keyFor(type, title, issued) {
  return `${type}-${crypto.createHash("sha1").update(`${title}|${issued}`).digest("hex").slice(0, 14)}`;
}
function bulacanFromSegment(seg = "") {
  const m = String(seg).match(/Bulacan\s*\(([^)]+)\)/i);
  if (m) return list(m[1]);
  if (/\bBulacan\b(?!\s*\()/i.test(seg)) return BULACAN.slice();
  return [];
}
function rainfallContextFromBlock(block = "") {
  let expecting = [];
  let affecting = [];

  const expectOld = block.match(/(?:Meanwhile,\s*)?expect\s+light\s+to\s+moderate(?:\s+with\s+occasional\s+heavy)?\s+rains?\s+over\s+([\s\S]*?)(?=within\s+the\s+next\s+\d+\s+hours?|Light\s+to\s+moderate(?:\s+with\s+occasional\s+heavy)?\s+rains?\s+(?:are\s+)?affecting|The\s+public|$)/i);
  const expectAdvisory = block.match(/Light\s+to\s+moderate(?:\s+with\s+occasional\s+heavy)?\s+rains?\s+are\s+expected\s+over\s+([\s\S]*?)(?=Light\s+to\s+moderate(?:\s+with\s+occasional\s+heavy)?\s+rains?\s+(?:are\s+)?affecting|The\s+public|$)/i);
  if (expectOld) expecting = bulacanFromSegment(expectOld[1]);
  else if (expectAdvisory) expecting = bulacanFromSegment(expectAdvisory[1]);

  const affectingMatch = block.match(/Light\s+to\s+moderate(?:\s+with\s+occasional\s+heavy)?\s+rains?\s+(?:are\s+)?affecting\s+([\s\S]*?)(?=(?:which|and)\s+may\s+(?:persist|affect)|The\s+public|$)/i);
  if (affectingMatch) affecting = bulacanFromSegment(affectingMatch[1]);

  return {
    expecting: [...new Set(expecting)],
    affecting: [...new Set(affecting)]
  };
}

function parseHeavy(text) {
  const start = text.search(/Heavy Rainfall Warning No\.\s*\d+/i);
  if (start < 0) return null;
  let block = text.slice(start);
  const stop = block.search(/As of today, there is no Thunderstorm Advisory|Thunderstorm Advisory(?: No\.|\s)/i);
  if (stop > 0) block = block.slice(0, stop);
  const no = (block.match(/Heavy Rainfall Warning No\.\s*(\d+)/i) || [])[1];
  const issued = (block.match(/Issued at:\s*([^\n]+)/i) || [])[1] || "";
  const system = (block.match(/Weather System:\s*([^\n]+)/i) || [])[1] || "";
  const levels = {};
  for (const level of ["RED", "ORANGE", "YELLOW"]) {
    const re = new RegExp(`${level} WARNING LEVEL:\\s*([\\s\\S]*?)(?:ASSOCIATED HAZARD:)`, "i");
    const m = block.match(re);
    levels[level] = m ? bulacanFromSegment(m[1]) : [];
  }
  const rainfallContext = rainfallContextFromBlock(block);
  const municipalities = [...new Set([...Object.values(levels).flat(), ...rainfallContext.expecting, ...rainfallContext.affecting])];
  if (!municipalities.length) return null;
  const title = `Heavy Rainfall Warning No. ${no || ""}`.trim();
  return {
    key: keyFor("heavy_rainfall", title, issued), type: "heavy_rainfall", title,
    warningNo: no || null, issuedAtText: clean(issued), weatherSystem: clean(system),
    levels, rainfallContext, municipalities, active: true, sourceName: "DOST-PAGASA NCR-PRSD",
    sourceUrl: NCR_URL, parserConfidence: issued && no?.length ? 0.99 : 0.9,
    rawExcerpt: clean(block).slice(0, 5000)
  };
}

function parseRainfallAdvisory(text) {
  const start = text.search(/Rainfall Advisory No\.\s*\d+/i);
  if (start < 0) return null;
  let block = text.slice(start);
  const next = block.slice(1).search(/Rainfall Advisory No\.\s*\d+|Heavy Rainfall Warning No\.\s*\d+|Thunderstorm Advisory(?: No\.|\s)/i);
  if (next >= 0) block = block.slice(0, next + 1);

  const no = (block.match(/Rainfall Advisory No\.\s*(\d+)/i) || [])[1] || null;
  const issued = (block.match(/Issued at:\s*([^\n]+)/i) || [])[1] || "";
  const system = (block.match(/Weather System:\s*([^\n]+)/i) || [])[1] || "";
  const rainfallContext = rainfallContextFromBlock(block);
  const municipalities = [...new Set([...rainfallContext.expecting, ...rainfallContext.affecting])];
  if (!municipalities.length) return null;

  const title = no ? `Rainfall Advisory No. ${no}` : "Rainfall Advisory";
  return {
    key: keyFor("rainfall_advisory", title, issued), type: "rainfall_advisory", title,
    advisoryNo: no, issuedAtText: clean(issued), weatherSystem: clean(system),
    levels: {}, rainfallContext, municipalities, active: true,
    sourceName: "DOST-PAGASA NCR-PRSD", sourceUrl: NCR_URL,
    parserConfidence: issued && no ? 0.99 : 0.9,
    rawExcerpt: clean(block).slice(0, 5000)
  };
}

function parseThunder(text) {
  if (/no Thunderstorm Advisory Issued/i.test(text)) return null;
  const i = text.search(/Thunderstorm Advisory(?: No\.)?/i);
  if (i < 0) return null;
  const block = text.slice(i, i + 5000);
  if (!/Bulacan/i.test(block)) return null;
  const no = (block.match(/Thunderstorm Advisory(?: No\.)?\s*(\d+)?/i) || [])[1] || null;
  const issued = (block.match(/Issued at:\s*([^\n]+)/i) || [])[1] || "";
  let municipalities = bulacanFromSegment(block);
  if (!municipalities.length) {
    municipalities = BULACAN.filter(n => new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(block));
  }
  municipalities = [...new Set(municipalities)];
  if (!municipalities.length) return null;
  const title = no ? `Thunderstorm Advisory No. ${no}` : "Thunderstorm Advisory";
  return {
    key: keyFor("thunderstorm", title, issued), type: "thunderstorm", title,
    issuedAtText: clean(issued), municipalities, levels: { THUNDERSTORM: municipalities },
    active: true, sourceName: "DOST-PAGASA NCR-PRSD", sourceUrl: NCR_URL,
    parserConfidence: issued ? 0.97 : 0.9, rawExcerpt: clean(block).slice(0, 4500)
  };
}

function parseTCWS(text) {
  if (/No Active Tropical Cyclone within the Philippine Area of Responsibility/i.test(text)) return null;
  if (!/Bulacan/i.test(text) || !/Tropical Cyclone Wind Signal/i.test(text)) return null;
  const issued = (text.match(/Issued at:\s*([^\n]+)/i) || [])[1] || "";
  const bulletinNo = (text.match(/Tropical Cyclone Bulletin\s*(?:No\.)?\s*(\d+)/i) || [])[1] || null;
  const name = (text.match(/(?:TROPICAL STORM|SEVERE TROPICAL STORM|TYPHOON|SUPER TYPHOON|TROPICAL DEPRESSION)\s+[“\"]?([A-Z][A-Z0-9 -]{2,})[”\"]?/i) || [])[1]?.trim() || "Active Tropical Cyclone";
  const levels = {};
  for (let n = 1; n <= 5; n++) {
    const re = new RegExp(`Tropical Cyclone Wind Signal(?: No\\.)?\\s*#?${n}([\\s\\S]*?)(?=Tropical Cyclone Wind Signal(?: No\\.)?\\s*#?${n + 1}|$)`, "i");
    const m = text.match(re);
    if (m) {
      const names = bulacanFromSegment(m[1]);
      if (names.length) levels[String(n)] = names;
    }
  }
  const municipalities = [...new Set(Object.values(levels).flat())];
  if (!municipalities.length) return null;
  const title = bulletinNo ? `TC Bulletin No. ${bulletinNo} · ${name}` : `TCWS · ${name}`;
  return {
    key: keyFor("tcws", title, issued), type: "tcws", title, issuedAtText: clean(issued),
    tcwsLevels: levels, municipalities, active: true, sourceName: "DOST-PAGASA",
    sourceUrl: TC_URL, parserConfidence: issued && Object.keys(levels).length ? 0.96 : 0.88,
    rawExcerpt: clean(text).slice(0, 6000)
  };
}

async function fetchText(url) {
  const r = await fetch(url, {
    headers: { "User-Agent": "BYDRRM-Weather/1.0 (+official disaster information monitor)", "Accept": "text/html" },
    signal: AbortSignal.timeout(20000)
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  const html = await r.text();
  const $ = cheerio.load(html);
  $("script,style,noscript").remove();
  $("br").replaceWith("\n");
  $("p,li,h1,h2,h3,h4,h5,h6,section,article").each((_, el) => $(el).append("\n"));
  return clean($("body").text().replace(/\r/g, "\n"));
}

function boldText(value = "") {
  return [...String(value)].map(ch => {
    const code = ch.codePointAt(0);
    if (code >= 65 && code <= 90) return String.fromCodePoint(0x1D400 + code - 65);
    if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D41A + code - 97);
    if (code >= 48 && code <= 57) return String.fromCodePoint(0x1D7CE + code - 48);
    return ch;
  }).join("");
}

function caption(a) {
  const where = (a.municipalities || []).join(", ");
  const row = (label, names) => `${boldText(label)}: ${names.join(", ")}`;
  let lead = `⚠️ ${boldText(a.title.toUpperCase())}\n\n`;

  if (a.type === "heavy_rainfall") {
    const rows = Object.entries(a.levels || {})
      .filter(([, v]) => v.length)
      .map(([level, names]) => row(level, names));
    if (a.rainfallContext?.affecting?.length) rows.push(row("AFFECTING", a.rainfallContext.affecting));
    if (a.rainfallContext?.expecting?.length) rows.push(row("EXPECTING", a.rainfallContext.expecting));
    lead += `${rows.join("\n")}\n\n`;
  } else if (a.type === "rainfall_advisory") {
    const rows = [];
    if (a.rainfallContext?.affecting?.length) rows.push(row("AFFECTING", a.rainfallContext.affecting));
    if (a.rainfallContext?.expecting?.length) rows.push(row("EXPECTING", a.rainfallContext.expecting));
    lead += `${rows.join("\n")}\n\n`;
  } else if (a.type === "tcws") {
    lead += Object.entries(a.tcwsLevels || {})
      .map(([level, names]) => row(`TCWS #${level}`, names))
      .join("\n") + "\n\n";
  } else {
    lead += `${boldText("AFFECTED AREAS IN BULACAN")}: ${where}\n\n`;
  }

  if (a.weatherSystem) lead += `${boldText("Weather System")}: ${a.weatherSystem}\n`;
  lead += `${boldText("Issued")}: ${a.issuedAtText || "See official bulletin"}\n\n`;
  lead += `Residents are advised to monitor official updates and follow instructions from local authorities.\n\n`;
  lead += `${boldText("Source")}: ${a.sourceName}\n`;
  lead += `#BYDRRM #WeatherAdvisory #Bulacan`;
  return lead;
}

async function renderPng(a) {
  return sharp(Buffer.from(GRAPHICS.graphicSvg(a))).png({ quality: 95 }).toBuffer();
}

async function postFacebook(a) {
  const token = META_PAGE_ACCESS_TOKEN.value();
  const page = META_PAGE_ID.value();
  if (!token || !page) throw new Error("Meta Page secret is not configured.");
  const png = await renderPng(a);
  const form = new FormData();
  form.append("caption", caption(a));
  form.append("published", "true");
  form.append("source", new Blob([png], { type: "image/png" }), `bydrrm-${a.key}.png`);
  const r = await fetch(`https://graph.facebook.com/v25.0/${encodeURIComponent(page)}/photos`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form
  });
  const data = await r.json();
  if (!r.ok || data.error) throw new Error(data.error?.message || `Meta HTTP ${r.status}`);
  return data;
}

async function settings() {
  const s = await db.doc("weather_settings/main").get();
  return s.exists ? s.data() : { autoPostEnabled: false };
}

async function upsertAndMaybePost(a, opts = { post: true }) {
  const ref = db.collection("weather_advisories").doc(a.key);
  const old = await ref.get();
  if (old.exists) return { state: "duplicate" };
  const now = admin.firestore.FieldValue.serverTimestamp();
  await ref.set({ ...a, createdAt: now, postStatus: "pending" });
  if (a.parserConfidence < 0.95) {
    await ref.update({ postStatus: "held", holdReason: "Parser confidence below auto-post threshold" });
    return { state: "held" };
  }
  const cfg = await settings();
  if (!opts.post || cfg.autoPostEnabled === false) {
    await ref.update({ postStatus: "held", holdReason: cfg.autoPostEnabled === false ? "Auto-post paused" : "Posting disabled for this scan" });
    return { state: "held" };
  }
  try {
    const fb = await postFacebook(a);
    const manila = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    await ref.update({ postStatus: "posted", facebookPhotoId: fb.id || null, facebookPostId: fb.post_id || null, postedAt: now, postedDateManila: manila });
    return { state: "posted" };
  } catch (e) {
    await ref.update({ postStatus: "failed", postError: String(e.message || e).slice(0, 500), lastPostAttemptAt: now });
    return { state: "failed", error: e.message };
  }
}

async function runScan() {
  const result = { detected: 0, posted: 0, held: 0, failed: 0, duplicates: 0 };
  try {
    const [ncr, tc] = await Promise.all([fetchText(NCR_URL), fetchText(TC_URL)]);
    const heavy = parseHeavy(ncr);
    const rainfallAdvisory = heavy ? null : parseRainfallAdvisory(ncr);
    const parsed = [heavy, rainfallAdvisory, parseThunder(ncr), parseTCWS(tc)].filter(Boolean);
    result.detected = parsed.length;
    for (const a of parsed) {
      const r = await upsertAndMaybePost(a, { post: true });
      if (r.state === "posted") result.posted++;
      else if (r.state === "held") result.held++;
      else if (r.state === "failed") result.failed++;
      else if (r.state === "duplicate") result.duplicates++;
    }
    await db.doc("weather_settings/main").set({ scannerHealthy: true, lastScanAt: admin.firestore.FieldValue.serverTimestamp(), lastScanResult: result }, { merge: true });
    return result;
  } catch (e) {
    await db.doc("weather_settings/main").set({ scannerHealthy: false, lastScanAt: admin.firestore.FieldValue.serverTimestamp(), lastScannerError: String(e.message || e).slice(0, 500) }, { merge: true });
    throw e;
  }
}

async function requireApproved(req, adminOnly = false) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const p = await db.doc(`users/${req.auth.uid}`).get();
  if (!p.exists || !p.data().approved || p.data().active === false) throw new HttpsError("permission-denied", "BYDRRM approval required.");
  if (adminOnly && p.data().role !== "admin") throw new HttpsError("permission-denied", "Administrator access required.");
  return p.data();
}
function safePostError(e) {
  return String(e?.message || e || "Unknown Facebook publishing error").replace(/access_token=[^&\s]+/gi, "access_token=[redacted]").slice(0, 500);
}

exports.scanWeatherAdvisories = onSchedule({
  schedule: "every 5 minutes", timeZone: "Asia/Manila", region: "asia-southeast1",
  secrets: [META_PAGE_ACCESS_TOKEN, META_PAGE_ID], retryCount: 1
}, runScan);

exports.scanWeatherNow = onCall({ region: "asia-southeast1", secrets: [META_PAGE_ACCESS_TOKEN, META_PAGE_ID] }, async req => {
  await requireApproved(req, false);
  return runScan();
});

exports.previewWeatherGraphic = onCall({ region: "asia-southeast1", memory: "512MiB" }, async req => {
  await requireApproved(req, true);
  const id = String(req.data?.id || "");
  if (!id) throw new HttpsError("invalid-argument", "Missing advisory id.");
  const snap = await db.collection("weather_advisories").doc(id).get();
  if (!snap.exists) throw new HttpsError("not-found", "Advisory not found.");
  const a = snap.data();
  if (a.parserConfidence < 0.95) throw new HttpsError("failed-precondition", "Only verified advisories can be previewed.");
  try {
    const png = await renderPng(a);
    return { mimeType: "image/png", imageBase64: png.toString("base64") };
  } catch (e) {
    throw new HttpsError("internal", String(e?.message || e).slice(0, 500));
  }
});

exports.retryWeatherPost = onCall({ region: "asia-southeast1", secrets: [META_PAGE_ACCESS_TOKEN, META_PAGE_ID] }, async req => {
  await requireApproved(req, true);
  const id = String(req.data?.id || "");
  if (!id) throw new HttpsError("invalid-argument", "Missing advisory id.");
  const ref = db.collection("weather_advisories").doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Advisory not found.");
  const a = snap.data();
  if (a.parserConfidence < 0.95) throw new HttpsError("failed-precondition", "Held advisory cannot be published automatically.");
  try {
    const fb = await postFacebook(a);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const manila = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    await ref.update({ postStatus: "posted", facebookPhotoId: fb.id || null, facebookPostId: fb.post_id || null, postedAt: now, postedDateManila: manila, postError: admin.firestore.FieldValue.delete() });
    return { ok: true, ...fb };
  } catch (e) {
    const message = safePostError(e);
    await ref.update({ postStatus: "failed", postError: message, lastPostAttemptAt: admin.firestore.FieldValue.serverTimestamp() });
    throw new HttpsError("internal", message, { message });
  }
});

exports._test = { parseHeavy, parseRainfallAdvisory, parseThunder, parseTCWS, rainfallContextFromBlock, caption };
