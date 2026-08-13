import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-functions.js";

const config = {
  apiKey: "AIzaSyDQxHN4yHy4sNrezgybP_amKaOlF7MYweM",
  authDomain: "bydrrm-studio.firebaseapp.com",
  projectId: "bydrrm-studio",
  storageBucket: "bydrrm-studio.firebasestorage.app",
  messagingSenderId: "734773689350",
  appId: "1:734773689350:web:9c3e9956881bd343eb1787"
};

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, "asia-southeast1");
const $ = s => document.querySelector(s);

let profile = null;
let latestRows = [];

function msg(text) {
  $("#authMessage").textContent = text;
}

function esc(value = "") {
  return String(value).replace(/[&<>\"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  })[c]);
}

function callableErrorMessage(error) {
  if (typeof error?.details === "string" && error.details) return error.details;
  if (error?.details?.message) return String(error.details.message);
  return error?.message || "Unknown error";
}

function isFacebookTokenExpired(message = "") {
  return /error validating access token|session has expired|access token.*expired|expired.*access token|oauthexception.*190/i.test(String(message));
}

function postedToday(row, today) {
  if (row.postStatus !== "posted") return false;
  if (row.postedDateManila) return row.postedDateManila === today;
  if (row.postedAt?.toDate) {
    const d = row.postedAt.toDate().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    return d === today;
  }
  return false;
}

async function ensureProfile(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Your BYDRRM account has not been approved yet.");
  return snap.data();
}

async function load() {
  const settingsSnap = await getDoc(doc(db, "weather_settings", "main"));
  const settings = settingsSnap.exists() ? settingsSnap.data() : {};

  $("#kpiAuto").textContent = settings.autoPostEnabled ? "ON" : "OFF";
  $("#autoSwitch").classList.toggle("on", !!settings.autoPostEnabled);
  $("#kpiScanner").textContent = settings.scannerHealthy === false ? "CHECK" : "LIVE";

  const qs = await getDocs(query(
    collection(db, "weather_advisories"),
    orderBy("createdAt", "desc"),
    limit(25)
  ));

  latestRows = qs.docs.map(d => ({ id: d.id, ...d.data() }));
  $("#kpiAlerts").textContent = latestRows.filter(x => x.active !== false).length;

  const currentTokenFailure = latestRows.find(x => x.active !== false && x.postStatus === "failed" && isFacebookTokenExpired(x.postError));
  if (settings.autoPostEnabled && currentTokenFailure) {
    $("#kpiAuto").textContent = "ON · TOKEN EXPIRED";
  }

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  $("#kpiPosts").textContent = latestRows.filter(x => postedToday(x, today)).length;

  $("#activityRows").innerHTML = latestRows.map((a, index) => {
    const verified = a.parserConfidence >= 0.95;
    const canPreview = profile?.role === "admin" && verified;
    const hasNewerSameType = latestRows.slice(0, index).some(x => x.type === a.type && x.parserConfidence >= 0.95);
    const historicalFailed = a.postStatus === "failed" && hasNewerSameType;
    const tokenExpired = a.postStatus === "failed" && isFacebookTokenExpired(a.postError);
    const latestVerifiedForType = verified && !hasNewerSameType;
    const manualEligibleStatus = ["held", "failed", "pending"].includes(a.postStatus);
    const canManualPost = profile?.role === "admin" && latestVerifiedForType && manualEligibleStatus && !tokenExpired;

    let facebookLabel = (a.postStatus || "not posted").toUpperCase();
    let facebookClass = a.postStatus === "posted" ? "ok" : a.postStatus === "failed" && !historicalFailed ? "fail" : "";
    let facebookStyle = "";

    if (tokenExpired && !historicalFailed) {
      facebookLabel = "FACEBOOK TOKEN EXPIRED";
      facebookClass = "fail";
      facebookStyle = "color:#ff8e98";
    } else if (!settings.autoPostEnabled && ["pending", "held"].includes(a.postStatus)) {
      facebookLabel = "WAITING · AUTO-POST OFF";
      facebookStyle = "color:#d7e1ea";
    } else if (a.postStatus === "held" && settings.autoPostEnabled) {
      facebookLabel = "WAITING · AUTO-POST ON";
      facebookStyle = "color:#ffd980";
    } else if (a.postStatus === "pending") {
      facebookLabel = "PENDING · NEEDS CHECK";
      facebookStyle = "color:#ffd980";
    } else if (a.postStatus === "publishing") {
      facebookLabel = "PUBLISHING…";
      facebookStyle = "color:#8ed8ff";
    } else if (historicalFailed) {
      facebookLabel = "PREVIOUS FAILED ATTEMPT";
      facebookClass = "";
      facebookStyle = "color:#8fa1b4";
    }

    let errorLine = "";
    if (tokenExpired && !historicalFailed) {
      errorLine = `<br><span style="display:inline-block;margin-top:7px;color:#ffb4ba;font-size:11px;max-width:230px;line-height:1.4">The stored Meta Page access token has expired. Renew the server-side token before publishing.</span><details style="margin-top:7px;max-width:230px;color:#8fa1b4;font-size:11px"><summary style="cursor:pointer;color:#9fb0bf">Technical details</summary><div style="margin-top:6px;line-height:1.35;overflow-wrap:anywhere">${esc(a.postError || "")}</div></details>`;
    } else if (a.postStatus === "failed" && a.postError) {
      if (historicalFailed) {
        errorLine = `<details style="margin-top:7px;max-width:230px;color:#8fa1b4;font-size:11px"><summary style="cursor:pointer;color:#9fb0bf">View old error</summary><div style="margin-top:6px;line-height:1.35;overflow-wrap:anywhere">${esc(a.postError)}</div></details>`;
      } else {
        errorLine = `<br><span style="display:inline-block;margin-top:6px;color:#ff9a9a;font-size:11px;max-width:230px;line-height:1.35;overflow-wrap:anywhere">${esc(a.postError)}</span>`;
      }
    }

    const reasonLine = a.holdReason && a.postStatus === "held"
      ? `<br><span style="display:inline-block;margin-top:5px;color:#8fa1b4;font-size:11px;max-width:230px;line-height:1.35">${esc(a.holdReason)}</span>`
      : "";

    const facebookCell = `
      <span class="${facebookClass}" style="${facebookStyle}">${esc(facebookLabel)}</span>
      ${reasonLine}
      ${errorLine}
      ${canPreview ? `<br><button class="btn secondary preview-graphic" data-id="${esc(a.id)}" style="margin-top:8px;padding:7px 10px;font-size:12px">Preview graphic</button>` : ""}
      ${canManualPost ? `<br><button class="btn secondary manual-post" data-id="${esc(a.id)}" style="margin-top:6px;padding:7px 10px;font-size:12px">Publish manually</button>` : ""}
      ${tokenExpired && latestVerifiedForType ? `<br><button class="btn secondary" disabled style="margin-top:6px;padding:7px 10px;font-size:12px;opacity:.6">Renew token first</button>` : ""}
    `;

    return `<tr>
      <td><b>${esc(a.title || a.type)}</b><br><span style="color:#71859b">${esc(a.weatherSystem || "")}</span></td>
      <td>${esc(a.issuedAtText || "—")}</td>
      <td class="log-status ${verified ? "ok" : "fail"}">${verified ? "VERIFIED" : "HELD"}</td>
      <td>${facebookCell}</td>
    </tr>`;
  }).join("") || '<tr><td colspan="4">No weather advisory records yet.</td></tr>';
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    $("#authGate").classList.remove("hidden");
    $("#adminApp").classList.add("hidden");
    return;
  }

  try {
    profile = await ensureProfile(user);
    if (!profile.approved || profile.active === false) {
      throw new Error("This account is not currently authorized.");
    }

    $("#profileLine").textContent = `${user.email} · ${profile.role || "volunteer"}`;
    $("#authGate").classList.add("hidden");
    $("#adminApp").classList.remove("hidden");
    $("#autoSwitch").disabled = profile.role !== "admin";
    $("#pausePosting").disabled = profile.role !== "admin";
    await load();
  } catch (e) {
    await signOut(auth);
    msg(e.message);
  }
});

$("#signIn").onclick = () => signInWithPopup(auth, new GoogleAuthProvider()).catch(e => msg(e.message));
$("#signOut").onclick = () => signOut(auth);
$("#refresh").onclick = load;

async function runScannerNow({ quiet = false } = {}) {
  const r = await httpsCallable(functions, "scanWeatherNow")({});
  if (!quiet) {
    alert(`Scan complete: ${r.data.detected} detected, ${r.data.posted} posted, ${r.data.held} held, ${r.data.duplicates || 0} duplicate.`);
  }
  await load();
  return r.data;
}

$("#scanNow").onclick = async () => {
  const button = $("#scanNow");
  button.disabled = true;
  button.textContent = "Scanning…";
  try {
    await runScannerNow();
  } catch (e) {
    alert(callableErrorMessage(e));
  } finally {
    button.disabled = false;
    button.textContent = "Run scan";
  }
};

$("#activityRows").addEventListener("click", async event => {
  const previewButton = event.target.closest(".preview-graphic");
  if (previewButton && profile?.role === "admin") {
    const advisory = latestRows.find(a => a.id === previewButton.dataset.id);
    if (!advisory || advisory.parserConfidence < 0.95) {
      alert("Only verified advisories can be previewed.");
      return;
    }

    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) {
      alert("Please allow pop-ups for this site so the graphic preview can open.");
      return;
    }
    previewWindow.document.write('<div style="font-family:system-ui;padding:24px;background:#07121e;color:white;min-height:100vh">Generating preview…</div>');
    previewButton.disabled = true;
    previewButton.textContent = "Generating…";
    try {
      const r = await httpsCallable(functions, "previewWeatherGraphic")({ id: advisory.id });
      const src = `data:${r.data.mimeType || "image/png"};base64,${r.data.imageBase64}`;
      previewWindow.document.open();
      previewWindow.document.write(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(advisory.title || "Weather Graphic Preview")}</title></head><body style="margin:0;background:#07121e;display:flex;align-items:flex-start;justify-content:center;min-height:100vh"><img src="${src}" alt="Weather graphic preview" style="display:block;width:100%;max-width:1080px;height:auto"></body></html>`);
      previewWindow.document.close();
    } catch (e) {
      previewWindow.close();
      alert(`Graphic preview failed: ${callableErrorMessage(e)}`);
    } finally {
      previewButton.disabled = false;
      previewButton.textContent = "Preview graphic";
    }
    return;
  }

  const button = event.target.closest(".manual-post");
  if (!button || profile?.role !== "admin") return;

  const advisory = latestRows.find(a => a.id === button.dataset.id);
  if (!advisory || advisory.parserConfidence < 0.95 || !["held", "failed", "pending"].includes(advisory.postStatus)) {
    alert("This advisory is no longer eligible for manual publishing.");
    await load();
    return;
  }

  if (isFacebookTokenExpired(advisory.postError)) {
    alert("The Meta Page access token has expired. Renew the server-side token first, then refresh and publish the latest advisory.");
    return;
  }

  const newerSameType = latestRows.some(a => a.type === advisory.type && a.parserConfidence >= 0.95 && a.id !== advisory.id && latestRows.indexOf(a) < latestRows.indexOf(advisory));
  if (newerSameType) {
    alert("A newer verified advisory of this type already exists. Refresh the dashboard and publish the latest one instead.");
    await load();
    return;
  }

  const ok = confirm(
    `Publish this VERIFIED advisory to the BYDRRM Facebook Page now?\n\n${advisory.title}\n${advisory.issuedAtText || ""}\n\nThis will publish immediately using the current graphic and caption.`
  );
  if (!ok) return;

  button.disabled = true;
  button.textContent = "Publishing…";
  try {
    await httpsCallable(functions, "retryWeatherPost")({ id: advisory.id });
    alert("Facebook post published successfully.");
    await load();
  } catch (e) {
    alert(`Facebook publish failed: ${callableErrorMessage(e)}`);
    await load();
  } finally {
    button.disabled = false;
    button.textContent = "Publish manually";
  }
});

$("#autoSwitch").onclick = async () => {
  if (profile?.role !== "admin") return;
  const button = $("#autoSwitch");
  button.disabled = true;
  try {
    const ref = doc(db, "weather_settings", "main");
    const snap = await getDoc(ref);
    const next = !(snap.exists() && snap.data().autoPostEnabled);
    await setDoc(ref, { autoPostEnabled: next, updatedAt: serverTimestamp() }, { merge: true });
    await load();
    if (next) {
      try {
        await runScannerNow({ quiet: true });
      } catch (e) {
        alert(`Full Auto is ON, but the immediate verification scan failed: ${callableErrorMessage(e)}`);
      }
    }
  } catch (e) {
    alert(`Could not change Full Auto: ${e.message || e}`);
  } finally {
    button.disabled = profile?.role !== "admin";
  }
};

$("#pausePosting").onclick = async () => {
  if (profile?.role !== "admin") return;
  await setDoc(doc(db, "weather_settings", "main"), {
    autoPostEnabled: false,
    pausedAt: serverTimestamp()
  }, { merge: true });
  await load();
  alert("Facebook auto-posting paused. Monitoring remains active.");
};
