function loadStudioImage(inputId,setter){
  document.getElementById(inputId).onchange=(e)=>{
    const file=e.target.files[0]; if(!file){setter(null);generatePosterGraphic();return;}
    const img=new Image(); img.onload=()=>{setter(img);generatePosterGraphic();};
    img.src=URL.createObjectURL(file);
  };
}
loadStudioImage("studioLogo",img=>studioLogoImage=img);
loadStudioImage("studioSourceLogo",img=>studioSourceLogoImage=img);

function toLocalInputValue(iso){
  if(!iso)return ""; const d=new Date(iso); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,16);
}
function statusDisplay(s){return s==="WATCH"?"ALERT / WATCH":s.replace("_"," ");}
function statusRank(s){return ({NO_DATA:0,NORMAL:1,WATCH:2,ALARM:3,CRITICAL:4})[s]||0;}
function posterStatusColor(status){return ({NORMAL:"#20c6a4",WATCH:"#f0c451",ALARM:"#f28d35",CRITICAL:"#ff4e67","NO_DATA":"#8294a6"})[status]||"#8294a6";}
function thresholdFor(id){return thresholds[String(id)]||null;}
function verifiedThreshold(p){return !!(p&&p.verified&&Number.isFinite(Number(p.alert))&&Number.isFinite(Number(p.alarm))&&Number.isFinite(Number(p.critical))&&p.source);}
function thresholdText(p){
  if(!verifiedThreshold(p)) return null;
  return [
    {label:"NORMAL",value:`below ${Number(p.alert).toFixed(2)} m`},
    {label:"ALERT / WATCH",value:`${Number(p.alert).toFixed(2)} m`},
    {label:"ALARM",value:`${Number(p.alarm).toFixed(2)} m`},
    {label:"CRITICAL",value:`${Number(p.critical).toFixed(2)} m`}
  ];
}
function loadThresholdEditor(){
  const id=Number(studioStation.value), p=thresholdFor(id);
  document.getElementById("thresholdAlert").value=verifiedThreshold(p)?Number(p.alert).toFixed(2):"";
  document.getElementById("thresholdAlarm").value=verifiedThreshold(p)?Number(p.alarm).toFixed(2):"";
  document.getElementById("thresholdCritical").value=verifiedThreshold(p)?Number(p.critical).toFixed(2):"";
  document.getElementById("thresholdSource").value=verifiedThreshold(p)?p.source:"";
  const state=document.getElementById("thresholdState");
  if(verifiedThreshold(p)){
    state.className="threshold-state ok";
    state.textContent=`Verified profile saved • Source: ${p.source}`;
  }else{
    state.className="threshold-state warn";
    state.textContent="Official thresholds not encoded. Poster will show that message instead of sample values.";
  }
}
function saveThresholdProfile(){
  const id=Number(studioStation.value);
  const alertLevel=Number(document.getElementById("thresholdAlert").value);
  const alarm=Number(document.getElementById("thresholdAlarm").value);
  const critical=Number(document.getElementById("thresholdCritical").value);
  const source=document.getElementById("thresholdSource").value.trim();
  if(![alertLevel,alarm,critical].every(Number.isFinite)||alertLevel<=0||alarm<=0||critical<=0){window.alert("Enter all three verified threshold levels.");return;}
  if(!(alertLevel<alarm&&alarm<critical)){window.alert("Thresholds must be ordered: Alert/Watch < Alarm < Critical.");return;}
  if(!source){window.alert("Add the official threshold source/reference before saving.");return;}
  thresholds[String(id)]={alert:alertLevel,alarm,critical,source,verified:true,savedAt:new Date().toISOString()};
  localStorage.setItem(THRESHOLD_KEY,JSON.stringify(thresholds));
  loadThresholdEditor(); updateLevelGuide(); generatePosterGraphic();
}
function clearThresholdProfile(){
  const id=Number(studioStation.value); delete thresholds[String(id)];
  localStorage.setItem(THRESHOLD_KEY,JSON.stringify(thresholds));
  loadThresholdEditor(); updateLevelGuide(); generatePosterGraphic();
}
function useLatestForStudio(){
  const id=Number(studioStation.value), r=latest(id);
  if(!r){
    document.getElementById("studioLevel").value="";
    document.getElementById("studioRise").value="";
    document.getElementById("studioStatus").value="NO_DATA";
    document.getElementById("studioTime").value="";
    document.getElementById("studioSource").value="Manual / unverified";
    return;
  }
  document.getElementById("studioLevel").value=Number(r.level).toFixed(2);
  const rr=rateOfRise(id); document.getElementById("studioRise").value=rr===null?"":(rr*100).toFixed(1);
  document.getElementById("studioStatus").value=r.status;
  document.getElementById("studioTime").value=toLocalInputValue(r.time);
  const src=document.getElementById("studioSource");
  if([...src.options].some(o=>o.value===r.source)) src.value=r.source; else src.value="Manual / unverified";
}
function selectSameMunicipality(){
  const primary=STATIONS.find(x=>x.id===Number(studioStation.value)); if(!primary)return;
  [...studioMultiStations.options].forEach(o=>{const s=STATIONS.find(x=>x.id===Number(o.value));o.selected=s&&s.municipality===primary.municipality;});
  generatePosterGraphic();
}
function selectedBoardStations(){
  let ids=[...studioMultiStations.selectedOptions].map(o=>Number(o.value));
  if(!ids.length) ids=[Number(studioStation.value)];
  return ids.slice(0,6).map(id=>STATIONS.find(s=>s.id===id)).filter(Boolean);
}
function roundedRect(ctx,x,y,w,h,r){
  const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();
}
function wrapLines(ctx,text,maxWidth){
  const words=(text||"").split(/\s+/).filter(Boolean), lines=[]; let line="";
  for(const word of words){const test=line?line+" "+word:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word}else line=test} if(line)lines.push(line);return lines;
}
function drawContain(ctx,img,x,y,w,h){
  if(!img)return; const r=Math.min(w/img.width,h/img.height); const dw=img.width*r,dh=img.height*r; ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
}
function drawBuiltInMark(ctx,x,y,size){
  ctx.save();ctx.translate(x,y);ctx.fillStyle="#0d5f99";ctx.beginPath();ctx.arc(size/2,size/2,size/2,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle="#dff5ff";ctx.lineWidth=Math.max(4,size*.07);ctx.beginPath();ctx.arc(size*.5,size*.46,size*.23,Math.PI*.12,Math.PI*.88);ctx.stroke();ctx.beginPath();ctx.arc(size*.5,size*.58,size*.29,Math.PI*1.12,Math.PI*1.88);ctx.stroke();ctx.restore();
}
