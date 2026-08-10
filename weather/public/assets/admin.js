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

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  $("#kpiPosts").textContent = latestRows.filter(x => postedToday(x, today)).length;

  $("#activityRows").innerHTML = latestRows.map(a => {
    const verified = a.parserConfidence >= 0.95;
    const canTestPost = profile?.role === "admin" && verified && ["held", "failed"].includes(a.postStatus);
    const errorLine = a.postStatus === "failed" && a.postError
      ? `<br><span style="display:inline-block;margin-top:6px;color:#ff9a9a;font-size:11px;max-width:260px">${esc(a.postError)}</span>`
      : "";
    const facebookCell = `
      <span class="${a.postStatus === "posted" ? "ok" : a.postStatus === "failed" ? "fail" : ""}">
        ${esc((a.postStatus || "not posted").toUpperCase())}
      </span>
      ${errorLine}
      ${canTestPost ? `<br><button class="btn secondary test-post" data-id="${esc(a.id)}" style="margin-top:8px;padding:7px 10px;font-size:12px">${a.postStatus === "failed" ? "Retry test" : "Publish test"}</button>` : ""}
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

$("#scanNow").onclick = async () => {
  const button = $("#scanNow");
  button.disabled = true;
  button.textContent = "Scanning…";
  try {
    const r = await httpsCallable(functions, "scanWeatherNow")({});
    alert(`Scan complete: ${r.data.detected} detected, ${r.data.posted} posted, ${r.data.held} held, ${r.data.duplicates || 0} duplicate.`);
    await load();
  } catch (e) {
    alert(callableErrorMessage(e));
  } finally {
    button.disabled = false;
    button.textContent = "Run scan";
  }
};

$("#activityRows").addEventListener("click", async event => {
  const button = event.target.closest(".test-post");
  if (!button || profile?.role !== "admin") return;

  const advisory = latestRows.find(a => a.id === button.dataset.id);
  if (!advisory || advisory.parserConfidence < 0.95 || !["held", "failed"].includes(advisory.postStatus)) {
    alert("This advisory is no longer eligible for a controlled test post.");
    await load();
    return;
  }

  const ok = confirm(
    `Publish this VERIFIED advisory to the BYDRRM Facebook Page now?\n\n${advisory.title}\n${advisory.issuedAtText || ""}\n\nFacebook Full Auto will remain OFF.`
  );
  if (!ok) return;

  button.disabled = true;
  button.textContent = "Publishing…";
  try {
    await httpsCallable(functions, "retryWeatherPost")({ id: advisory.id });
    alert("Controlled Facebook test post published successfully. Full Auto remains OFF.");
    await load();
  } catch (e) {
    alert(`Facebook test post failed: ${callableErrorMessage(e)}`);
    await load();
  } finally {
    button.disabled = false;
    button.textContent = "Retry test";
  }
});

$("#autoSwitch").onclick = async () => {
  if (profile?.role !== "admin") return;
  const ref = doc(db, "weather_settings", "main");
  const snap = await getDoc(ref);
  const next = !(snap.exists() && snap.data().autoPostEnabled);
  await setDoc(ref, { autoPostEnabled: next, updatedAt: serverTimestamp() }, { merge: true });
  await load();
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
