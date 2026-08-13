import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDQxHN4yHy4sNrezgybP_amKaOlF7MYweM",
  authDomain: "bydrrm-studio.firebaseapp.com",
  projectId: "bydrrm-studio",
  storageBucket: "bydrrm-studio.firebasestorage.app",
  messagingSenderId: "734773689350",
  appId: "1:734773689350:web:9c3e9956881bd343eb1787",
  measurementId: "G-M33W8289R6"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
const BOOTSTRAP_ADMIN_EMAIL = "lomboylester.nursing@gmail.com";

const STORAGE_KEY = "bydrrm_weather_advisories_v01";
const LGUS = [
  "Angat", "Balagtas", "Baliwag City", "Bocaue", "Bulakan", "Bustos", "Calumpit",
  "Doña Remedios Trinidad", "Guiguinto", "Hagonoy", "Malolos City", "Marilao",
  "Meycauayan City", "Norzagaray", "Obando", "Pandi", "Paombong", "Plaridel",
  "Pulilan", "San Ildefonso", "San Jose del Monte City", "San Miguel", "San Rafael", "Santa Maria"
];

const levelStyles = {
  yellow: { accent: "#ffcc3d", soft: "#4d3b08", label: "YELLOW" },
  orange: { accent: "#ff8a34", soft: "#4b2409", label: "ORANGE" },
  red: { accent: "#ff5868", soft: "#4d111a", label: "RED" },
  blue: { accent: "#58a2ff", soft: "#0c2c54", label: "GENERAL" }
};

const els = Object.fromEntries([
  "authGate", "authHeading", "authMessage", "googleSignIn", "authSignOut", "authMeta",
  "draftCount", "readyCount", "publishedCount", "recentList", "historyList",
  "studioTitle", "editorStatus", "advisoryType", "warningLevel", "source", "headline",
  "issuedAt", "validUntil", "details", "actionText", "lguGrid", "caption", "posterCanvas",
  "newAdvisoryBtn", "selectAllLgus", "clearLgus", "regenerateCaption", "copyCaption",
  "downloadPng", "saveDraft", "markReady", "postNow", "postModal", "verifySource",
  "verifyGraphic", "cancelPost", "confirmPost", "toast"
].map(id => [id, document.getElementById(id)]));

let currentId = null;
let currentStatus = "Draft";
let currentUser = null;
let historyFilter = "all";
let toastTimer = null;
let logoImage = null;

function nowLocalInput(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function uid() {
  return `wx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecords(records) { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }

function upsertRecord(record) {
  const records = loadRecords();
  const index = records.findIndex(item => item.id === record.id);
  if (index >= 0) records[index] = record;
  else records.unshift(record);
  saveRecords(records);
  renderDashboard();
  renderHistory();
  return record;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.add("hidden"), 3500);
}

function showAuthGate(heading, message, meta, showSignIn, showSignOut) {
  els.authGate.classList.remove("hidden");
  els.authHeading.textContent = heading;
  els.authMessage.textContent = message;
  els.authMeta.textContent = meta || "";
  els.googleSignIn.classList.toggle("hidden", !showSignIn);
  els.authSignOut.classList.toggle("hidden", !showSignOut);
}

async function ensureUserProfile(user) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const isBootstrap = (user.email || "").toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
  if (!snap.exists()) {
    const profile = {
      uid: user.uid,
      name: user.displayName || "",
      email: user.email || "",
      photoURL: user.photoURL || "",
      role: isBootstrap ? "admin" : "volunteer",
      approved: isBootstrap,
      active: true,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp()
    };
    await setDoc(userRef, profile);
    return profile;
  }
  const profile = snap.data();
  await setDoc(userRef, {
    name: user.displayName || profile.name || "",
    email: user.email || profile.email || "",
    photoURL: user.photoURL || profile.photoURL || "",
    lastLoginAt: serverTimestamp()
  }, { merge: true });
  if (isBootstrap && (!profile.approved || profile.role !== "admin" || profile.active === false)) {
    const updated = { ...profile, role: "admin", approved: true, active: true };
    await setDoc(userRef, { role: "admin", approved: true, active: true, lastLoginAt: serverTimestamp() }, { merge: true });
    return updated;
  }
  return profile;
}

els.googleSignIn.addEventListener("click", async () => {
  try { await signInWithPopup(auth, googleProvider); }
  catch (error) {
    showAuthGate("Sign-in failed", error?.message || "Unable to sign in.", "Try again using an approved BYDRRM Google account.", true, false);
  }
});
els.authSignOut.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (!user) {
    showAuthGate("Authorized Personnel Access", "Sign in using an approved BYDRRM Google account. New accounts remain pending until approved by the administrator.", "BYDRRM Weather · Firebase Authentication", true, false);
    return;
  }
  showAuthGate("Checking access…", "Verifying your BYDRRM account.", user.email || "", false, true);
  try {
    const profile = await ensureUserProfile(user);
    if (!profile.approved || profile.active === false) {
      showAuthGate(
        profile.active === false ? "Access disabled" : "Access request pending",
        profile.active === false ? "This account is currently disabled. Contact the BYDRRM administrator." : "Your Google account is registered but still needs one-time administrator approval.",
        `${user.email || ""} · UID: ${user.uid}`,
        false,
        true
      );
      return;
    }
    els.authGate.classList.add("hidden");
    renderDashboard(); renderHistory();
  } catch (error) {
    showAuthGate("Unable to verify access", error?.message || "Firebase verification failed.", user.email || "", false, true);
  }
});

function navigate(view) {
  document.querySelectorAll(".view").forEach(node => node.classList.toggle("active", node.dataset.view === view));
  document.querySelectorAll(".nav-item").forEach(node => node.classList.toggle("active", node.dataset.nav === view));
  if (view === "studio" && !currentId) resetForm();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-nav]").forEach(btn => btn.addEventListener("click", () => navigate(btn.dataset.nav)));
document.querySelectorAll("[data-open-studio]").forEach(btn => btn.addEventListener("click", () => { resetForm(); navigate("studio"); }));

function renderLgus() {
  els.lguGrid.innerHTML = "";
  LGUS.forEach(name => {
    const label = document.createElement("label"); label.className = "lgu-chip";
    const input = document.createElement("input"); input.type = "checkbox"; input.value = name; input.addEventListener("change", updatePreview);
    const span = document.createElement("span"); span.textContent = name;
    label.append(input, span); els.lguGrid.appendChild(label);
  });
}
function selectedLgus() { return [...els.lguGrid.querySelectorAll("input:checked")].map(input => input.value); }
function setSelectedLgus(items = []) { const wanted = new Set(items); els.lguGrid.querySelectorAll("input").forEach(input => { input.checked = wanted.has(input.value); }); }
function formatDateTime(value) {
  if (!value) return "Not specified";
  const date = new Date(value); if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function collectForm() {
  const created = currentId ? loadRecords().find(item => item.id === currentId)?.createdAt : null;
  return {
    id: currentId || uid(), status: currentStatus, advisoryType: els.advisoryType.value,
    warningLevel: els.warningLevel.value, source: els.source.value.trim() || "DOST-PAGASA",
    headline: els.headline.value.trim(), issuedAt: els.issuedAt.value, validUntil: els.validUntil.value,
    details: els.details.value.trim(), actionText: els.actionText.value.trim(), municipalities: selectedLgus(),
    caption: els.caption.value, createdAt: created || new Date().toISOString(), updatedAt: new Date().toISOString(),
    updatedBy: currentUser?.email || ""
  };
}

function generateCaption() {
  const type = els.advisoryType.value;
  const headline = els.headline.value.trim();
  const areas = selectedLgus();
  const details = els.details.value.trim();
  const actionText = els.actionText.value.trim();
  const source = els.source.value.trim() || "DOST-PAGASA";
  const issued = formatDateTime(els.issuedAt.value);
  const valid = els.validUntil.value ? formatDateTime(els.validUntil.value) : "Until superseded / as stated by the official source";
  const areaText = areas.length ? areas.join(", ") : "Please refer to the official advisory for affected areas";
  return [
    `WEATHER ADVISORY | ${type.toUpperCase()}`,
    headline ? `\n${headline}` : "", `\nAs of: ${issued}`, `Valid until: ${valid}`,
    `\nAffected areas: ${areaText}`, details ? `\n${details}` : "", actionText ? `\nREMINDER: ${actionText}` : "",
    `\nSource: ${source}`, `\n#BYDRRM #BulacanWeather #WeatherAdvisory`
  ].join("").trim();
}

function updateStatusBadge() { els.editorStatus.textContent = currentStatus; els.editorStatus.className = `badge ${currentStatus.toLowerCase()}`; }

function resetForm() {
  currentId = null; currentStatus = "Draft"; els.studioTitle.textContent = "Create Advisory";
  els.advisoryType.value = "Heavy Rainfall Warning"; els.warningLevel.value = "yellow"; els.source.value = "DOST-PAGASA";
  els.headline.value = ""; els.issuedAt.value = nowLocalInput(); els.validUntil.value = ""; els.details.value = "";
  els.actionText.value = "Monitor official updates and avoid flooded or unsafe roads. Residents in flood-prone and riverside areas should remain alert.";
  setSelectedLgus([]); els.caption.value = generateCaption(); updateStatusBadge(); updatePreview(false);
}

function loadIntoForm(record) {
  currentId = record.id; currentStatus = record.status || "Draft"; els.studioTitle.textContent = "Edit Advisory";
  els.advisoryType.value = record.advisoryType || "Weather Advisory"; els.warningLevel.value = record.warningLevel || "blue";
  els.source.value = record.source || "DOST-PAGASA"; els.headline.value = record.headline || ""; els.issuedAt.value = record.issuedAt || nowLocalInput();
  els.validUntil.value = record.validUntil || ""; els.details.value = record.details || ""; els.actionText.value = record.actionText || "";
  setSelectedLgus(record.municipalities || []); els.caption.value = record.caption || generateCaption(); updateStatusBadge(); updatePreview(false);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 10) {
  if (!text) return y;
  const paragraphs = String(text).split(/\n+/); let linesUsed = 0; let cursorY = y;
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean); let line = "";
    for (let i = 0; i < words.length; i++) {
      const test = line ? `${line} ${words[i]}` : words[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, cursorY); cursorY += lineHeight; linesUsed += 1; line = words[i];
        if (linesUsed >= maxLines) return cursorY;
      } else line = test;
    }
    if (line && linesUsed < maxLines) { ctx.fillText(line, x, cursorY); cursorY += lineHeight; linesUsed += 1; }
  }
  return cursorY;
}
function roundedRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

function drawPoster() {
  const ctx = els.posterCanvas.getContext("2d"); const data = collectForm(); const style = levelStyles[data.warningLevel] || levelStyles.blue;
  const bg = ctx.createLinearGradient(0, 0, 1080, 1350); bg.addColorStop(0, "#061126"); bg.addColorStop(.58, "#091b35"); bg.addColorStop(1, "#040b17");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 1080, 1350);
  const glow = ctx.createRadialGradient(890, 80, 20, 890, 80, 430); glow.addColorStop(0, `${style.accent}33`); glow.addColorStop(1, "#00000000"); ctx.fillStyle = glow; ctx.fillRect(0, 0, 1080, 700);
  ctx.fillStyle = style.accent; ctx.fillRect(0, 0, 1080, 18);
  if (logoImage?.complete) { ctx.save(); roundedRect(ctx, 62, 62, 92, 92, 22); ctx.clip(); ctx.drawImage(logoImage, 62, 62, 92, 92); ctx.restore(); }
  else { ctx.fillStyle = "#14305c"; roundedRect(ctx, 62, 62, 92, 92, 22); ctx.fill(); }
  ctx.fillStyle = "#fff"; ctx.font = "900 32px Arial"; ctx.fillText("BYDRRM WEATHER", 178, 102);
  ctx.fillStyle = "#91a8ca"; ctx.font = "700 19px Arial"; ctx.fillText("BULACAN WEATHER ADVISORY", 178, 135);
  ctx.fillStyle = style.soft; roundedRect(ctx, 810, 72, 205, 56, 28); ctx.fill(); ctx.strokeStyle = `${style.accent}88`; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = style.accent; ctx.font = "900 22px Arial"; ctx.textAlign = "center"; ctx.fillText(style.label, 912, 108); ctx.textAlign = "left";
  ctx.fillStyle = "#7aaeff"; ctx.font = "900 22px Arial"; ctx.fillText(data.advisoryType.toUpperCase(), 62, 235);
  ctx.fillStyle = "#fff"; ctx.font = "900 58px Arial"; let y = wrapText(ctx, data.headline || data.advisoryType, 62, 310, 930, 66, 4);
  ctx.fillStyle = "#a8bad5"; ctx.font = "700 19px Arial"; ctx.fillText(`AS OF ${formatDateTime(data.issuedAt).toUpperCase()}`, 62, y + 12); y += 58;
  ctx.fillStyle = "rgba(255,255,255,.045)"; roundedRect(ctx, 62, y, 956, 190, 26); ctx.fill(); ctx.strokeStyle = "rgba(177,205,255,.20)"; ctx.stroke();
  ctx.fillStyle = style.accent; ctx.font = "900 19px Arial"; ctx.fillText("AFFECTED AREAS", 92, y + 48);
  ctx.fillStyle = "#fff"; ctx.font = "800 28px Arial"; wrapText(ctx, data.municipalities.length ? data.municipalities.join(" • ") : "Affected areas not yet selected", 92, y + 90, 890, 38, 3); y += 220;
  ctx.fillStyle = "#7aaeff"; ctx.font = "900 19px Arial"; ctx.fillText("SITUATION", 62, y);
  ctx.fillStyle = "#eaf1fb"; ctx.font = "600 27px Arial"; y = wrapText(ctx, data.details || "Enter the verified advisory details before publishing.", 62, y + 43, 950, 40, 7) + 28;
  ctx.fillStyle = "rgba(45,120,255,.10)"; roundedRect(ctx, 62, y, 956, 170, 24); ctx.fill(); ctx.strokeStyle = "rgba(85,160,255,.24)"; ctx.stroke();
  ctx.fillStyle = "#79adff"; ctx.font = "900 18px Arial"; ctx.fillText("REMINDER", 92, y + 43);
  ctx.fillStyle = "#dce9fb"; ctx.font = "600 23px Arial"; wrapText(ctx, data.actionText || "Monitor official updates and remain alert.", 92, y + 82, 890, 33, 3);
  const footerY = 1240; ctx.strokeStyle = "rgba(177,205,255,.18)"; ctx.beginPath(); ctx.moveTo(62, footerY); ctx.lineTo(1018, footerY); ctx.stroke();
  ctx.fillStyle = "#8fa5c5"; ctx.font = "700 17px Arial"; ctx.fillText(`SOURCE: ${(data.source || "DOST-PAGASA").toUpperCase()}`, 62, footerY + 45);
  ctx.textAlign = "right"; ctx.fillText("FOR INFORMATION · VERIFY BEFORE SHARING", 1018, footerY + 45); ctx.textAlign = "left";
  ctx.fillStyle = "#fff"; ctx.font = "900 18px Arial"; ctx.fillText("Bulacan Youth Disaster Risk Reduction and Management", 62, 1323);
}
function updatePreview(regenerate = true) { if (regenerate) els.caption.value = generateCaption(); drawPoster(); }

[els.advisoryType, els.warningLevel, els.source, els.headline, els.issuedAt, els.validUntil, els.details, els.actionText].forEach(input => input.addEventListener("input", () => updatePreview(true)));
els.caption.addEventListener("input", drawPoster);
els.selectAllLgus.addEventListener("click", () => { setSelectedLgus(LGUS); updatePreview(true); });
els.clearLgus.addEventListener("click", () => { setSelectedLgus([]); updatePreview(true); });
els.regenerateCaption.addEventListener("click", () => { els.caption.value = generateCaption(); showToast("Caption regenerated."); });
els.newAdvisoryBtn.addEventListener("click", () => { resetForm(); showToast("New advisory started."); });

async function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const temp = document.createElement("textarea"); temp.value = text; document.body.appendChild(temp); temp.select(); document.execCommand("copy"); temp.remove();
}
els.copyCaption.addEventListener("click", async () => { try { await copyText(els.caption.value); showToast("Caption copied."); } catch { showToast("Unable to copy caption. Select and copy it manually."); } });

function createPngBlob() { drawPoster(); return new Promise((resolve, reject) => els.posterCanvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG generation failed")), "image/png", 1)); }
async function downloadPoster() {
  const blob = await createPngBlob(); const data = collectForm(); const stamp = (data.issuedAt || nowLocalInput()).replace(/[:T]/g, "-");
  const name = `BYDRRM-${data.advisoryType.replace(/[^a-z0-9]+/gi, "-")}-${stamp}.png`; const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); return { blob, name };
}
els.downloadPng.addEventListener("click", async () => { try { await downloadPoster(); showToast("PNG downloaded."); } catch (error) { showToast(error?.message || "Unable to download PNG."); } });

function saveWithStatus(status) {
  currentStatus = status; if (!currentId) currentId = uid(); const record = collectForm(); record.id = currentId; record.status = status; upsertRecord(record);
  updateStatusBadge(); els.studioTitle.textContent = "Edit Advisory"; showToast(status === "Ready" ? "Advisory marked Ready." : "Draft saved."); return record;
}
els.saveDraft.addEventListener("click", () => saveWithStatus("Draft"));
els.markReady.addEventListener("click", () => {
  if (!els.headline.value.trim() || !els.details.value.trim() || selectedLgus().length === 0) { showToast("Add a headline, verified details, and at least one affected area first."); return; }
  saveWithStatus("Ready");
});

function openPostModal() {
  if (!els.headline.value.trim() || !els.details.value.trim() || selectedLgus().length === 0) { showToast("Complete the advisory details and affected areas before posting."); return; }
  if (currentStatus !== "Ready") saveWithStatus("Ready");
  els.verifySource.checked = false; els.verifyGraphic.checked = false; els.confirmPost.disabled = true; els.postModal.classList.remove("hidden");
}
function closePostModal() { els.postModal.classList.add("hidden"); }
function syncPostConfirm() { els.confirmPost.disabled = !(els.verifySource.checked && els.verifyGraphic.checked); }
els.postNow.addEventListener("click", openPostModal); els.cancelPost.addEventListener("click", closePostModal);
els.verifySource.addEventListener("change", syncPostConfirm); els.verifyGraphic.addEventListener("change", syncPostConfirm);
els.postModal.addEventListener("click", event => { if (event.target === els.postModal) closePostModal(); });

els.confirmPost.addEventListener("click", async () => {
  els.confirmPost.disabled = true;
  try {
    const record = saveWithStatus("Ready"); const blob = await createPngBlob();
    const file = new File([blob], `BYDRRM-${record.advisoryType.replace(/[^a-z0-9]+/gi, "-")}.png`, { type: "image/png" }); closePostModal();
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: record.headline || record.advisoryType, text: els.caption.value, files: [file] });
      const confirmed = window.confirm("Was the advisory successfully posted to the correct BYDRRM Facebook Page?\n\nOK = Mark Published\nCancel = Keep as Ready");
      if (confirmed) markPublished(record.id); else showToast("Post handoff completed. Status kept as Ready.");
      return;
    }
    await copyText(els.caption.value).catch(() => {}); await downloadPoster(); window.open("https://www.facebook.com/", "_blank", "noopener,noreferrer");
    showToast("PNG downloaded and caption copied. Facebook opened for manual posting.");
  } catch (error) {
    if (error?.name === "AbortError") showToast("Posting cancelled. Advisory remains Ready."); else showToast(error?.message || "Unable to open the manual share flow.");
  } finally { els.confirmPost.disabled = false; }
});

function markPublished(id) {
  const records = loadRecords(); const index = records.findIndex(item => item.id === id); if (index < 0) return;
  records[index] = { ...records[index], status: "Published", publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; saveRecords(records);
  if (currentId === id) { currentStatus = "Published"; updateStatusBadge(); }
  renderDashboard(); renderHistory(); showToast("Advisory marked Published.");
}
function deleteRecord(id) {
  saveRecords(loadRecords().filter(item => item.id !== id)); if (currentId === id) resetForm(); renderDashboard(); renderHistory(); showToast("Advisory deleted.");
}
function duplicateRecord(id) {
  const source = loadRecords().find(item => item.id === id); if (!source) return;
  const copy = { ...source, id: uid(), status: "Draft", headline: source.headline ? `${source.headline} (Update)` : "", issuedAt: nowLocalInput(), validUntil: "", caption: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), publishedAt: null };
  upsertRecord(copy); loadIntoForm(copy); els.caption.value = generateCaption(); drawPoster(); navigate("studio"); showToast("Advisory duplicated as a new draft.");
}
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
function makeHistoryCard(record, compact = false) {
  const card = document.createElement("div"); card.className = "history-card"; const areas = record.municipalities?.length ? record.municipalities.join(", ") : "No affected areas selected";
  const badgeClass = (record.status || "Draft").toLowerCase();
  card.innerHTML = `<div class="history-top"><div><div class="history-title">${escapeHtml(record.headline || record.advisoryType || "Untitled advisory")}</div><div class="history-meta">${escapeHtml(record.advisoryType || "Weather Advisory")} · ${escapeHtml(formatDateTime(record.issuedAt))}</div></div><span class="badge ${badgeClass}">${escapeHtml(record.status || "Draft")}</span></div><div class="history-areas">${escapeHtml(areas)}</div>${compact ? "" : `<div class="history-actions"><button data-action="edit">Edit</button><button data-action="duplicate">Duplicate</button>${record.status !== "Published" ? '<button data-action="published">Mark Published</button>' : ""}<button class="danger" data-action="delete">Delete</button></div>`}`;
  if (compact) { card.style.cursor = "pointer"; card.addEventListener("click", () => { loadIntoForm(record); navigate("studio"); }); }
  else {
    card.querySelector('[data-action="edit"]')?.addEventListener("click", () => { loadIntoForm(record); navigate("studio"); });
    card.querySelector('[data-action="duplicate"]')?.addEventListener("click", () => duplicateRecord(record.id));
    card.querySelector('[data-action="published"]')?.addEventListener("click", () => markPublished(record.id));
    card.querySelector('[data-action="delete"]')?.addEventListener("click", () => { if (window.confirm("Delete this advisory from local history?")) deleteRecord(record.id); });
  }
  return card;
}
function renderDashboard() {
  const records = loadRecords().sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  els.draftCount.textContent = records.filter(r => r.status === "Draft").length; els.readyCount.textContent = records.filter(r => r.status === "Ready").length; els.publishedCount.textContent = records.filter(r => r.status === "Published").length;
  els.recentList.innerHTML = ""; if (!records.length) { els.recentList.innerHTML = '<div class="history-empty">No advisories yet. Create the first manual weather advisory.</div>'; return; }
  records.slice(0, 3).forEach(record => els.recentList.appendChild(makeHistoryCard(record, true)));
}
function renderHistory() {
  const records = loadRecords().sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)); const filtered = historyFilter === "all" ? records : records.filter(record => record.status === historyFilter);
  els.historyList.innerHTML = ""; if (!filtered.length) { els.historyList.innerHTML = '<div class="history-empty">No advisories in this filter.</div>'; return; }
  filtered.forEach(record => els.historyList.appendChild(makeHistoryCard(record)));
}
document.querySelectorAll(".filter").forEach(btn => btn.addEventListener("click", () => { historyFilter = btn.dataset.filter; document.querySelectorAll(".filter").forEach(node => node.classList.toggle("active", node === btn)); renderHistory(); }));

renderLgus();
logoImage = new Image(); logoImage.src = "../icon-192.png"; logoImage.onload = drawPoster;
resetForm(); renderDashboard(); renderHistory();
