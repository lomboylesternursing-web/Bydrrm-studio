const STATIONS = [{"id": 1, "name": "Matictic Bridge", "municipality": "Norzagaray", "location": "Barangay Matictic, Norzagaray", "lat": 14.91036, "lng": 121.05106, "description": "Staff gauge painted on a bridge post; 3-meter graduation mark.", "source_type": "PDRRMO documented water-level station"}, {"id": 2, "name": "Angat–DRT Bridge / Sta. Lucia", "municipality": "Angat", "location": "Barangay Sta. Lucia, Angat", "lat": 14.941694444444444, "lng": 121.02108333333334, "description": "Staff gauge on Angat–DRT Bridge, upstream side.", "source_type": "PDRRMO documented water-level station"}, {"id": 3, "name": "Bustos Dam Downstream / Tibagan", "municipality": "Bustos", "location": "Barangay Tibagan, Bustos", "lat": 14.95836111111111, "lng": 120.95022222222222, "description": "Staff gauge about 80–100 m downstream of Bustos Dam.", "source_type": "PDRRMO documented water-level station"}, {"id": 4, "name": "Alejo Santos Bridge – Bustos Side", "municipality": "Bustos", "location": "Barangay Poblacion, Bustos", "lat": 14.956111, "lng": 120.908056, "description": "Gauge on Alejo Santos Bridge, left bank, upstream side.", "source_type": "PDRRMO documented water-level station"}, {"id": 5, "name": "Alejo Santos Bridge – Baliwag Side", "municipality": "Baliwag", "location": "Barangay Tibag, Baliwag", "lat": 14.958222222222222, "lng": 120.90486111111112, "description": "4-meter staff gauge on Alejo Santos Bridge, right bank, downstream side.", "source_type": "PDRRMO documented water-level station"}, {"id": 6, "name": "Plaridel–Pulilan Bridge – Parulan", "municipality": "Plaridel", "location": "Barangay Parulan, Plaridel", "lat": 14.893333333333333, "lng": 120.87294444444444, "description": "6-meter staff gauge on Plaridel–Pulilan Bridge, downstream side.", "source_type": "PDRRMO documented water-level station"}, {"id": 7, "name": "Plaridel–Pulilan Bridge – Sto. Cristo", "municipality": "Pulilan", "location": "Barangay Sto. Cristo, Pulilan", "lat": 14.893333333333333, "lng": 120.87294444444444, "description": "Gauge on Plaridel–Pulilan Bridge, right bank, downstream side.", "source_type": "PDRRMO documented water-level station"}, {"id": 8, "name": "Pulilan–Plaridel Bridge – Banga 1st", "municipality": "Plaridel", "location": "Barangay Banga 1st, Plaridel", "lat": 14.892833333333332, "lng": 120.86513888888888, "description": "5-meter staff gauge on bridge post, left bank, downstream side.", "source_type": "PDRRMO documented water-level station"}, {"id": 9, "name": "NLEX Bridge – Tibag", "municipality": "Pulilan", "location": "Barangay Tibag, Pulilan", "lat": 14.905416666666667, "lng": 120.81949999999999, "description": "4.5-meter staff gauge on NLEX southbound bridge, upstream side.", "source_type": "PDRRMO documented water-level station"}, {"id": 10, "name": "Bagbag Bridge – Caniogan", "municipality": "Calumpit", "location": "Barangay Caniogan, Calumpit", "lat": 14.90484, "lng": 120.77556, "description": "3.5-meter staff gauge on Bagbag Bridge, upstream side.", "source_type": "PDRRMO documented water-level station"}, {"id": 11, "name": "Calumpit Bridge – Calizon", "municipality": "Calumpit", "location": "Calumpit Bridge, Calizon, Calumpit", "lat": 14.92, "lng": 120.7658, "description": "Official PDRRMO water-level monitoring location at Calumpit Bridge.", "source_type": "PDRRMO documented water-level station"}, {"id": 12, "name": "Oriente Bridge – San Vicente", "municipality": "San Miguel", "location": "Barangay San Vicente, San Miguel", "lat": 15.142194444444444, "lng": 120.96672222222223, "description": "3.5-meter gauge along San Miguel River beside Oriente Bridge, upstream side.", "source_type": "PDRRMO documented water-level station"}, {"id": 13, "name": "San Juan Bridge", "municipality": "San Miguel", "location": "Poblacion, San Miguel", "lat": 15.13917, "lng": 120.97754, "description": "Official PDRRMO water-level monitoring location at San Juan Bridge.", "source_type": "PDRRMO documented water-level station"}, {"id": 14, "name": "Salacot Bridge – Ilog Bulo", "municipality": "San Miguel", "location": "Salacot Bridge, Ilog Bulo, San Miguel", "lat": 15.182716, "lng": 120.960437, "description": "Official PDRRMO water-level monitoring location at Salacot Bridge.", "source_type": "PDRRMO documented water-level station"}, {"id": 15, "name": "Madlum River – Sibul", "municipality": "San Miguel", "location": "Madlum River, Sibul, San Miguel", "lat": 15.17036, "lng": 121.08295, "description": "Official PDRRMO river water-level monitoring location.", "source_type": "PDRRMO documented water-level station"}, {"id": 16, "name": "Maasim Bridge", "municipality": "San Ildefonso", "location": "Barangay Maasim, San Ildefonso", "lat": 15.040112, "lng": 120.937818, "description": "3.5-meter staff gauge on Maasim Bridge along Maharlika Highway, upstream side.", "source_type": "PDRRMO documented water-level station"}, {"id": 17, "name": "Sta. Maria Bridge", "municipality": "Santa Maria", "location": "Poblacion, Santa Maria", "lat": 14.819027777777778, "lng": 120.95752777777778, "description": "More than 3-meter staff gauge near Sta. Maria Bridge, upstream side.", "source_type": "PDRRMO documented water-level station"}, {"id": 18, "name": "Cadiz Bridge", "municipality": "San Jose del Monte", "location": "Centro, San Jose del Monte, near SJDM National High School", "lat": 14.811111111111112, "lng": 121.04944444444445, "description": "Staff gauge installed near Cadiz Bridge / SJDM National High School.", "source_type": "PDRRMO documented water-level station"}, {"id": 19, "name": "Karyapay Bridge – Dulong Bayan", "municipality": "San Jose del Monte", "location": "Karyapay Bridge, Dulong Bayan, San Jose del Monte", "lat": 14.830586, "lng": 121.042403, "description": "Staff gauge installed at Karyapay Bridge, Dulong Bayan.", "source_type": "PDRRMO documented water-level station"}];
const STORAGE_KEY = "bydrrm-riverwatch-readings-v1";
let readings = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
let demoMode = localStorage.getItem("bydrrm-riverwatch-demo") === "1";
let markers = {};

const map = L.map("map").setView([14.98,120.92],10);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
  maxZoom:19, attribution:"&copy; OpenStreetMap contributors"
}).addTo(map);

function statusColor(s){
  return ({NORMAL:"#2dd4a8",WATCH:"#ffd166",ALARM:"#ff9f43",CRITICAL:"#ff5d73",NO_DATA:"#7f91a4"})[s] || "#7f91a4";
}
function latest(id){ const arr=readings[id]||[]; return arr.length?arr[arr.length-1]:null; }
function previous(id){ const arr=readings[id]||[]; return arr.length>1?arr[arr.length-2]:null; }
function rateOfRise(id){
  const a=previous(id), b=latest(id); if(!a||!b) return null;
  const h=(new Date(b.time)-new Date(a.time))/3600000; if(h<=0) return null;
  return (b.level-a.level)/h;
}
function trendText(id){
  const r=rateOfRise(id); if(r===null) return "Trend unavailable";
  const cm=Math.abs(r*100);
  if(Math.abs(r)<0.005) return "→ Stable";
  return r>0 ? `↑ ${cm.toFixed(1)} cm/hr` : `↓ ${cm.toFixed(1)} cm/hr`;
}
function fmtTime(t){
  if(!t) return "No observation";
  return new Date(t).toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
}
function popupHtml(s){
  const r=latest(s.id), st=r?r.status:"NO_DATA";
  return `<div style="min-width:220px">
    <b>${s.name}</b><br><span style="opacity:.7">${s.location}</span><hr style="border-color:#29435b">
    <div style="font-size:24px;font-weight:800">${r ? Number(r.level).toFixed(2)+" m" : "NO DATA"}</div>
    <div>${r ? trendText(s.id) : "No current official/manual reading loaded"}</div>
    <div style="margin-top:8px;font-size:11px;opacity:.7">${r ? `${fmtTime(r.time)} • ${r.source}` : s.source_type}</div>
  </div>`;
}
function renderMarkers(){
  STATIONS.forEach(s=>{
    const r=latest(s.id), st=r?r.status:"NO_DATA";
    if(markers[s.id]) map.removeLayer(markers[s.id]);
    const marker=L.circleMarker([s.lat,s.lng],{
      radius:9,fillColor:statusColor(st),color:"#e8f5ff",weight:1,opacity:.9,fillOpacity:.9
    }).addTo(map).bindPopup(popupHtml(s));
    markers[s.id]=marker;
  });
}
function stationCard(s){
  const r=latest(s.id), st=r?r.status:"NO_DATA";
  return `<div class="station" data-id="${s.id}">
    <div class="station-head">
      <div><div class="station-name">${s.name}</div><div class="station-loc">${s.municipality} • ${s.location}</div></div>
      <span class="status ${st}">${st.replace("_"," ")}</span>
    </div>
    <div class="reading">
      <div><div class="big">${r ? Number(r.level).toFixed(2)+" m" : "—"}</div><div class="trend">${r ? trendText(s.id) : "Awaiting data"}</div></div>
      <div style="text-align:right"><div>${r?fmtTime(r.time):""}</div><div class="meta">${r?r.source:""}</div></div>
    </div>
  </div>`;
}
function renderList(){
  const q=document.getElementById("search").value.trim().toLowerCase();
  const filtered=STATIONS.filter(s=>`${s.name} ${s.location} ${s.municipality}`.toLowerCase().includes(q));
  document.getElementById("stationList").innerHTML=filtered.map(stationCard).join("");
  document.querySelectorAll(".station").forEach(el=>{
    el.onclick=()=>{ const id=Number(el.dataset.id); markers[id].openPopup(); map.panTo(markers[id].getLatLng()); };
  });
}
function renderStats(){
  let reporting=0,rising=0,critical=0,nodata=0;
  STATIONS.forEach(s=>{
    const r=latest(s.id);
    if(!r){nodata++;return}
    reporting++;
    const rr=rateOfRise(s.id); if(rr!==null&&rr>0.005) rising++;
    if(["ALARM","CRITICAL"].includes(r.status)) critical++;
  });
  document.getElementById("statStations").textContent=STATIONS.length;
  document.getElementById("statReporting").textContent=reporting;
  document.getElementById("statRising").textContent=rising;
  document.getElementById("statCritical").textContent=critical;
  document.getElementById("statNoData").textContent=nodata;
}
function render(){
  document.getElementById("demoBanner").classList.toggle("show",demoMode);
  renderMarkers(); renderList(); renderStats();
}
function save(){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(readings));
  localStorage.setItem("bydrrm-riverwatch-demo",demoMode?"1":"0");
  render();
}

function setFeedState(prefix, text, kind, meta){
  const state=document.getElementById(prefix+"State"), m=document.getElementById(prefix+"Meta");
  state.textContent=text; state.className="feed-state"+(kind?" "+kind:""); m.textContent=meta||"";
}
function mergeOfficialReading(obs){
  const id=Number(obs.stationId), level=Number(obs.level);
  if(!id||!Number.isFinite(level)||!obs.time) return false;
  readings[id]=readings[id]||[];
  const stamp=new Date(obs.time).toISOString();
  const exists=readings[id].some(x=>x.time===stamp && x.source===obs.source && Number(x.level)===level);
  if(exists) return false;
  readings[id].push({level,status:obs.status||"NORMAL",time:stamp,source:obs.source||"Official feed",note:obs.note||"",demo:false});
  readings[id].sort((a,b)=>new Date(a.time)-new Date(b.time));
  if(readings[id].length>96) readings[id]=readings[id].slice(-96);
  return true;
}
async function syncOfficialFeeds(){
  const btn=document.getElementById("syncBtn"); btn.disabled=true; btn.textContent="Syncing…";
  setFeedState("pdrrmo","SYNCING","warn","Checking the public Bulacan PDRRMO feed…");
  setFeedState("asti","SYNCING","warn","Checking official PhilSensors connector configuration…");
  try{
    const res=await fetch("/api/sync",{cache:"no-store"});
    if(!res.ok) throw new Error("Server returned "+res.status);
    const data=await res.json(); let added=0;
    (data.readings||[]).forEach(o=>{if(mergeOfficialReading(o)) added++});
    demoMode=false; save();
    const p=(data.sources||[]).find(x=>x.name==="Bulacan PDRRMO");
    const a=(data.sources||[]).find(x=>x.name==="DOST-ASTI PhilSensors");
    if(p){
      if(p.ok){
        const d=(p.dams||[]).length;
        setFeedState("pdrrmo","CONNECTED","ok",`River records: ${p.river_records||0} • imported: ${p.normalized_readings||0} • dam rows: ${d}. ${p.river_records?"Official river records found.":"PDRRMO currently returned no river-status records."}`);
      } else setFeedState("pdrrmo","ERROR","bad",p.error||"Unable to read PDRRMO feed.");
    }
    if(a){
      if(a.ok && a.configured) setFeedState("asti","CONNECTED","ok",`Official API configured • ${a.readings||0} mapped reading(s) received.`);
      else if(a.ok) setFeedState("asti","API PENDING","warn",a.message||"Official API URL/token not configured yet.");
      else setFeedState("asti","ERROR","bad",a.error||"PhilSensors connector error.");
    }
    btn.textContent=added?`✓ Synced • ${added} new`:'✓ Synced • no new readings';
    setTimeout(()=>btn.textContent="↻ Sync Official Feeds",3000);
  }catch(err){
    setFeedState("pdrrmo","SERVER NEEDED","warn","Run RiverWatch through server.py to sync official web/API sources. Static mode still supports verified manual observations and Posting Studio.");
    setFeedState("asti","API PENDING","warn","Official PhilSensors API access is not embedded in the static page.");
    btn.textContent="↻ Sync Official Feeds";
  }finally{btn.disabled=false}
}

const formStation=document.getElementById("formStation");
formStation.innerHTML=STATIONS.map(s=>`<option value="${s.id}">${s.name} — ${s.municipality}</option>`).join("");
document.getElementById("updateBtn").onclick=()=>{
  const n=new Date(); n.setMinutes(n.getMinutes()-n.getTimezoneOffset());
  document.getElementById("formTime").value=n.toISOString().slice(0,16);
  document.getElementById("updateDialog").showModal();
};
document.getElementById("saveUpdate").onclick=(e)=>{
  const id=Number(formStation.value), level=Number(document.getElementById("formLevel").value);
  const time=document.getElementById("formTime").value;
  if(!Number.isFinite(level)||!time){e.preventDefault();return}
  readings[id]=readings[id]||[];
  readings[id].push({
    level, status:document.getElementById("formStatus").value,
    time:new Date(time).toISOString(),
    source:document.getElementById("formSource").value,
    note:document.getElementById("formNote").value.trim(),
    demo:false
  });
  readings[id].sort((a,b)=>new Date(a.time)-new Date(b.time));
  demoMode=false; save();
  document.getElementById("updateForm").reset();
};
document.getElementById("search").oninput=renderList;
document.getElementById("syncBtn").onclick=syncOfficialFeeds;

document.getElementById("demoBtn").onclick=()=>{
  readings={}; const now=Date.now();
  STATIONS.forEach((s,i)=>{
    const base=1.5+(i%7)*0.34;
    const change=[0.02,0.08,0.15,-0.03,0.0][i%5];
    readings[s.id]=[
      {level:base,time:new Date(now-3600000).toISOString(),status:"NORMAL",source:"SIMULATED DEMO",note:"",demo:true},
      {level:Math.max(0,base+change),time:new Date(now).toISOString(),status:i%9===0?"ALARM":i%4===0?"WATCH":"NORMAL",source:"SIMULATED DEMO",note:"",demo:true}
    ];
  });
  demoMode=true; save();
};
document.getElementById("clearBtn").onclick=()=>{
  if(confirm("Clear all locally stored readings?")){ readings={}; demoMode=false; save(); }
};
document.getElementById("exportBtn").onclick=()=>{
  const payload={exportedAt:new Date().toISOString(),demoMode,readings};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="riverwatch-readings.json";a.click();URL.revokeObjectURL(a.href);
};
document.getElementById("importFile").onchange=async(e)=>{
  const f=e.target.files[0]; if(!f)return;
  try{
    const obj=JSON.parse(await f.text());
    readings=obj.readings||obj; demoMode=!!obj.demoMode; save();
  }catch(err){alert("Invalid JSON file.");}
  e.target.value="";
};


// ===== RiverWatch Posting Studio =====
const studioStation=document.getElementById("studioStation");
const studioMultiStations=document.getElementById("studioMultiStations");
studioStation.innerHTML=STATIONS.map(s=>`<option value="${s.id}">${s.name} — ${s.municipality}</option>`).join("");
studioMultiStations.innerHTML=STATIONS.map(s=>`<option value="${s.id}">${s.name} — ${s.municipality}</option>`).join("");
const THRESHOLD_KEY="bydrrm-riverwatch-thresholds-v1";
let thresholds=JSON.parse(localStorage.getItem(THRESHOLD_KEY)||"{}");
let studioLogoImage=null, studioSourceLogoImage=null;
