function drawHeader(ctx,W,pad,accent){
  ctx.fillStyle=accent;ctx.fillRect(0,0,W,16);
  if(studioLogoImage) drawContain(ctx,studioLogoImage,pad,44,115,92); else drawBuiltInMark(ctx,pad,48,82);
  const tx=studioLogoImage?pad+140:pad+108;
  ctx.fillStyle="#ffffff";ctx.font="800 29px Arial";ctx.fillText("BULACAN YOUTH DRRM",tx,78);
  ctx.fillStyle="#72cfff";ctx.font="900 39px Arial";ctx.fillText("RIVERWATCH",tx,119);
  ctx.fillStyle="#92b5cc";ctx.font="600 18px Arial";ctx.fillText("PUBLIC WATER-LEVEL ADVISORY",tx,148);
  if(studioSourceLogoImage) drawContain(ctx,studioSourceLogoImage,W-pad-150,42,150,96);
}
function drawBackground(ctx,W,H,accent){
  const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,"#041426");g.addColorStop(.52,"#0a2b49");g.addColorStop(1,"#06111f");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.globalAlpha=.10;ctx.strokeStyle="#69cdfd";ctx.lineWidth=3;
  for(let y=H*.38;y<H+100;y+=76){ctx.beginPath();for(let x=-100;x<W+100;x+=32){const yy=y+Math.sin((x+y)/88)*14;if(x===-100)ctx.moveTo(x,yy);else ctx.lineTo(x,yy)}ctx.stroke()}ctx.globalAlpha=1;
  ctx.globalAlpha=.08;ctx.fillStyle=accent;ctx.beginPath();ctx.arc(W*.90,H*.12,W*.22,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
}
function drawFooter(ctx,W,H,pad){
  const fy=H-118;ctx.strokeStyle="#365c76";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(pad,fy-26);ctx.lineTo(W-pad,fy-26);ctx.stroke();
  ctx.fillStyle="#ffffff";ctx.font="800 21px Arial";ctx.fillText("BYDRRM RIVERWATCH",pad,fy);
  ctx.fillStyle="#91a8ba";ctx.font="500 16px Arial";ctx.fillText("Situational awareness only • Follow official government advisories.",pad,fy+33);
  ctx.fillStyle="#6fa6c9";ctx.textAlign="right";ctx.font="700 16px Arial";ctx.fillText("#BYDRRM  #BulacanRiverWatch",W-pad,fy+33);ctx.textAlign="left";
}
function watermarkNeeded(source){return demoMode||source==="Manual / unverified";}
function drawDraftWatermark(ctx,W,H){
  ctx.save();ctx.translate(W/2,H/2);ctx.rotate(-Math.PI/8);ctx.globalAlpha=.10;ctx.fillStyle="#ffffff";ctx.textAlign="center";ctx.font="900 84px Arial";ctx.fillText(demoMode?"SIMULATED DEMO":"DRAFT • VERIFY SOURCE",0,0);ctx.restore();
}
function formatObsTime(v){return v?new Date(v).toLocaleString([], {month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}):"Observation time unavailable";}
function drawThresholdLegend(ctx,pad,y,W,profile,compact=false){
  const bw=W-pad*2,panelH=compact?170:200;ctx.fillStyle="#071827";roundedRect(ctx,pad,y,bw,panelH,28);ctx.fill();
  ctx.fillStyle="#8fc5e3";ctx.font="800 19px Arial";ctx.fillText("OFFICIAL LEVEL GUIDE",pad+30,y+39);
  if(!verifiedThreshold(profile)){
    ctx.fillStyle="#ffffff";ctx.font="700 29px Arial";ctx.fillText("Official thresholds not encoded",pad+30,y+93);
    ctx.fillStyle="#8ea9bb";ctx.font=`500 ${compact?16:18}px Arial`;ctx.fillText("Add only a verified government threshold profile in RiverWatch Studio.",pad+30,y+(compact?120:130));
    return;
  }
  const rows=thresholdText(profile), col=(bw-60)/4;
  rows.forEach((r,i)=>{
    const x=pad+30+i*col;ctx.fillStyle=posterStatusColor(i===0?"NORMAL":i===1?"WATCH":i===2?"ALARM":"CRITICAL");ctx.fillRect(x,y+60,8,78);
    ctx.fillStyle="#ffffff";ctx.font="800 16px Arial";ctx.fillText(r.label,x+18,y+82);ctx.fillStyle="#b7d0df";ctx.font="600 20px Arial";ctx.fillText(r.value,x+18,y+116);
  });
  ctx.fillStyle="#7899ad";ctx.font="500 14px Arial";const src=profile.source.length>94?profile.source.slice(0,91)+"…":profile.source;ctx.fillText(`Threshold source: ${src}`,pad+30,y+170);
}
function generateSingleCaption(){
  const s=STATIONS.find(x=>x.id===Number(studioStation.value));
  const level=document.getElementById("studioLevel").value,rise=document.getElementById("studioRise").value,status=document.getElementById("studioStatus").value;
  const src=document.getElementById("studioSource").value,time=document.getElementById("studioTime").value,note=document.getElementById("studioNote").value.trim(),headline=document.getElementById("studioHeadline").value.trim();
  const p=thresholdFor(s.id), t=formatObsTime(time);
  let body=`🌊 BYDRRM RIVERWATCH ADVISORY\n\n📍 ${s.name}\n${s.municipality}, Bulacan\n\n`;
  body+=level?`Current Water Level: ${Number(level).toFixed(2)} m\n`:`Current Water Level: NO CURRENT DATA\n`;
  if(rise!=="") body+=`Trend: ${Number(rise)>0?"↑ Rising":Number(rise)<0?"↓ Falling":"→ Stable"} ${Math.abs(Number(rise)).toFixed(1)} cm/hr\n`;
  body+=`Status: ${statusDisplay(status)}\nAs of: ${t}\nSource: ${src}\n`;
  if(verifiedThreshold(p)) body+=`\nOfficial Level Guide: Normal below ${Number(p.alert).toFixed(2)} m | Alert/Watch ${Number(p.alert).toFixed(2)} m | Alarm ${Number(p.alarm).toFixed(2)} m | Critical ${Number(p.critical).toFixed(2)} m\nThreshold source: ${p.source}\n`;
  else body+=`\nOfficial threshold profile: Not yet encoded in RiverWatch.\n`;
  if(headline) body+=`\n${headline}\n`; if(note) body+=`\n${note}\n`;
  if(watermarkNeeded(src)) body+=`\n⚠️ DRAFT / VERIFY SOURCE BEFORE PUBLIC POSTING.\n`;
  body+=`\nMonitor official advisories and avoid flooded roads or bridges when conditions are unsafe.\n\n#BYDRRM #BulacanRiverWatch #Bulacan`;
  return body;
}
function generateMultiCaption(){
  const stations=selectedBoardStations();
  let body=`🌊 BYDRRM RIVERWATCH — MULTI-STATION UPDATE\n\n`;
  stations.forEach(s=>{const r=latest(s.id),rr=rateOfRise(s.id);body+=`📍 ${s.name}, ${s.municipality}: ${r?Number(r.level).toFixed(2)+" m":"NO DATA"} • ${r?statusDisplay(r.status):"NO DATA"}${rr===null?"":` • ${rr>0?"↑":"↓"}${Math.abs(rr*100).toFixed(1)} cm/hr`}\n`;});
  const note=document.getElementById("studioNote").value.trim(); if(note)body+=`\n${note}\n`;
  body+=`\nReadings must be verified against their listed sources and timestamps before public posting. Follow official government advisories.\n\n#BYDRRM #BulacanRiverWatch #Bulacan`;
  return body;
}
function generateCaption(){return document.getElementById("studioTemplate").value==="multi"?generateMultiCaption():generateSingleCaption();}

function generateSinglePoster(ctx,W,H,pad){
  const s=STATIONS.find(x=>x.id===Number(studioStation.value));
  const level=document.getElementById("studioLevel").value,rise=document.getElementById("studioRise").value,status=document.getElementById("studioStatus").value;
  const src=document.getElementById("studioSource").value,time=document.getElementById("studioTime").value,note=document.getElementById("studioNote").value.trim();
  const headline=document.getElementById("studioHeadline").value.trim()||(status==="NO_DATA"?"CURRENT READING UNAVAILABLE":status==="NORMAL"?"WATER LEVEL MONITORING":"WATER LEVEL UPDATE");
  const accent=posterStatusColor(status),compact=H<1500;drawBackground(ctx,W,H,accent);drawHeader(ctx,W,pad,accent);
  let y=compact?195:205;ctx.fillStyle=accent;roundedRect(ctx,pad,y,compact?330:360,compact?56:64,32);ctx.fill();ctx.fillStyle="#06121d";ctx.font=`900 ${compact?24:27}px Arial`;ctx.textAlign="center";ctx.fillText(statusDisplay(status),pad+(compact?165:180),y+(compact?36:41));ctx.textAlign="left";
  y+=compact?115:125;ctx.fillStyle="#ffffff";ctx.font=`900 ${compact?50:68}px Arial`;const headlineLines=wrapLines(ctx,headline.toUpperCase(),W-pad*2).slice(0,compact?2:3);for(const line of headlineLines){ctx.fillText(line,pad,y);y+=compact?59:78;}
  y+=compact?8:15;ctx.fillStyle="#c5e6f7";ctx.font=`800 ${compact?27:30}px Arial`;ctx.fillText(s.name,pad,y);y+=compact?34:38;ctx.fillStyle="#8db2c9";ctx.font=`600 ${compact?20:22}px Arial`;ctx.fillText(`${s.municipality}, Bulacan`,pad,y);
  y+=compact?42:55;const readingH=compact?210:250;ctx.fillStyle="#071827";roundedRect(ctx,pad,y,W-pad*2,readingH,30);ctx.fill();
  ctx.fillStyle="#8fc5e3";ctx.font=`800 ${compact?17:19}px Arial`;ctx.fillText("CURRENT WATER LEVEL",pad+34,y+(compact?36:42));ctx.fillStyle="#ffffff";ctx.font=`900 ${compact?76:88}px Arial`;ctx.fillText(level?`${Number(level).toFixed(2)} m`:"NO DATA",pad+32,y+(compact?118:135));
  const trend=rise!==""?`${Number(rise)>0?"↑ RISING":Number(rise)<0?"↓ FALLING":"→ STABLE"} ${Math.abs(Number(rise)).toFixed(1)} cm/hr`:"TREND UNAVAILABLE";
  ctx.fillStyle=rise!==""?(Number(rise)>0?"#ffd166":Number(rise)<0?"#65e2c3":"#b8d1e0"):"#93a8b8";ctx.font=`800 ${compact?23:27}px Arial`;ctx.fillText(trend,pad+34,y+(compact?162:188));
  ctx.fillStyle="#839fb2";ctx.font=`500 ${compact?16:18}px Arial`;ctx.fillText(`As of ${formatObsTime(time)}`,pad+34,y+(compact?192:224));
  y+=readingH+(compact?22:30);drawThresholdLegend(ctx,pad,y,W,thresholdFor(s.id),compact);
  y+=compact?195:235;ctx.fillStyle="#8fc5e3";ctx.font=`800 ${compact?16:18}px Arial`;ctx.fillText("DATA SOURCE",pad,y);ctx.fillStyle="#ffffff";ctx.font=`700 ${compact?21:24}px Arial`;ctx.fillText(src,pad,y+(compact?31:36));
  const footerTop=H-155;if(note){ctx.fillStyle="#bad3e1";ctx.font=`500 ${compact?18:21}px Arial`;let ny=y+(compact?68:84);const maxLines=Math.max(0,Math.min(compact?2:5,Math.floor((footerTop-ny)/(compact?26:31))));for(const line of wrapLines(ctx,note,W-pad*2).slice(0,maxLines)){ctx.fillText(line,pad,ny);ny+=compact?26:31;}}
  if(watermarkNeeded(src))drawDraftWatermark(ctx,W,H);drawFooter(ctx,W,H,pad);
}
function generateMultiPoster(ctx,W,H,pad){
  const stations=selectedBoardStations();
  const rows=stations.map(s=>({s,r:latest(s.id),rr:rateOfRise(s.id)}));
  let strongest="NO_DATA";rows.forEach(x=>{if(x.r&&statusRank(x.r.status)>statusRank(strongest))strongest=x.r.status;});
  const accent=posterStatusColor(strongest);drawBackground(ctx,W,H,accent);drawHeader(ctx,W,pad,accent);
  let y=220;ctx.fillStyle="#ffffff";ctx.font=`900 ${H>1500?64:54}px Arial`;ctx.fillText("BULACAN WATER-LEVEL",pad,y);y+=H>1500?74:64;ctx.fillText("MONITORING BOARD",pad,y);
  y+=38;ctx.fillStyle="#96bed4";ctx.font="600 20px Arial";ctx.fillText(`${rows.length} monitoring point${rows.length===1?"":"s"} • Latest stored observations • verify sources`,pad,y);
  y+=40;
  const tall=H>1500, cardH=tall?190:116, gap=tall?16:10;
  rows.forEach(({s,r,rr},idx)=>{
    const cy=y+idx*(cardH+gap);ctx.fillStyle="#071827";roundedRect(ctx,pad,cy,W-pad*2,cardH,tall?25:20);ctx.fill();
    const st=r?r.status:"NO_DATA";ctx.fillStyle=posterStatusColor(st);ctx.fillRect(pad,cy,11,cardH);
    ctx.fillStyle="#ffffff";ctx.font=`800 ${tall?24:20}px Arial`;ctx.fillText(s.name,pad+28,cy+(tall?38:30));ctx.fillStyle="#8eafc3";ctx.font=`600 ${tall?17:14}px Arial`;ctx.fillText(`${s.municipality}, Bulacan`,pad+28,cy+(tall?66:52));
    ctx.fillStyle="#ffffff";ctx.font=`900 ${tall?48:34}px Arial`;ctx.fillText(r?`${Number(r.level).toFixed(2)} m`:"NO DATA",pad+28,cy+(tall?127:93));
    ctx.fillStyle=posterStatusColor(st);roundedRect(ctx,W-pad-(tall?235:205),cy+(tall?26:18),tall?205:175,tall?48:38,tall?24:19);ctx.fill();ctx.fillStyle="#06121d";ctx.textAlign="center";ctx.font=`900 ${tall?17:14}px Arial`;ctx.fillText(statusDisplay(st),W-pad-(tall?132:118),cy+(tall?57:43));ctx.textAlign="left";
    ctx.fillStyle="#9bb7c9";ctx.font=`700 ${tall?17:14}px Arial`;ctx.fillText(rr===null?"Trend unavailable":`${rr>0?"↑ Rising":rr<0?"↓ Falling":"→ Stable"} ${Math.abs(rr*100).toFixed(1)} cm/hr`,W-pad-(tall?280:245),cy+(tall?123:84));
    ctx.fillStyle=verifiedThreshold(thresholdFor(s.id))?"#65e2c3":"#d9bd6b";ctx.font=`600 ${tall?14:12}px Arial`;ctx.fillText(verifiedThreshold(thresholdFor(s.id))?"✓ Threshold profile encoded":"Thresholds not encoded",W-pad-(tall?280:245),cy+(tall?151:104));
  });
  const note=document.getElementById("studioNote").value.trim();
  const bottom=y+rows.length*(cardH+gap)+8;if(note&&bottom<H-180){ctx.fillStyle="#bad3e1";ctx.font=`500 ${tall?20:17}px Arial`;let ny=bottom;for(const line of wrapLines(ctx,note,W-pad*2).slice(0,tall?3:2)){ctx.fillText(line,pad,ny);ny+=tall?29:24;}}
  const unsafe=demoMode||rows.some(x=>x.r&&x.r.source==="Manual / unverified");if(unsafe)drawDraftWatermark(ctx,W,H);
  drawFooter(ctx,W,H,pad);
}
function generatePosterGraphic(){
  const canvas=document.getElementById("posterCanvas"),ctx=canvas.getContext("2d"),format=document.getElementById("studioFormat").value;
  canvas.width=1080;canvas.height=format==="story"?1920:1350;const W=canvas.width,H=canvas.height,pad=72;ctx.clearRect(0,0,W,H);
  if(document.getElementById("studioTemplate").value==="multi")generateMultiPoster(ctx,W,H,pad);else generateSinglePoster(ctx,W,H,pad);
  document.getElementById("captionPreview").textContent=generateCaption();
}
function updateStudioTemplateUI(){
  const multi=document.getElementById("studioTemplate").value==="multi";
  document.getElementById("multiStationWrap").classList.toggle("studio-hidden",!multi);
  document.getElementById("multiStationActions").classList.toggle("studio-hidden",!multi);
  document.querySelectorAll(".single-only").forEach(el=>el.classList.toggle("studio-hidden",multi));
  document.getElementById("thresholdBox").classList.toggle("studio-hidden",multi);
  document.getElementById("useLatestReading").classList.toggle("studio-hidden",multi);
  if(multi&&![...studioMultiStations.selectedOptions].length)selectSameMunicipality();
  generatePosterGraphic();
}

document.getElementById("saveThreshold").onclick=saveThresholdProfile;
document.getElementById("clearThreshold").onclick=clearThresholdProfile;
document.getElementById("selectMunicipality").onclick=selectSameMunicipality;
document.getElementById("useLatestReading").onclick=()=>{useLatestForStudio();generatePosterGraphic();};
document.getElementById("generatePoster").onclick=generatePosterGraphic;
document.getElementById("studioTemplate").onchange=updateStudioTemplateUI;
document.getElementById("studioFormat").onchange=generatePosterGraphic;
document.getElementById("studioStation").onchange=()=>{useLatestForStudio();loadThresholdEditor();const lg=document.getElementById("levelGuideStation");if(lg){lg.value=studioStation.value;updateLevelGuide();}if(document.getElementById("studioTemplate").value==="multi")selectSameMunicipality();generatePosterGraphic();};
studioMultiStations.onchange=generatePosterGraphic;
["studioStatus","studioLevel","studioRise","studioTime","studioSource","studioHeadline","studioNote"].forEach(id=>{const el=document.getElementById(id);el.addEventListener("input",generatePosterGraphic);el.addEventListener("change",generatePosterGraphic);});
document.getElementById("downloadPoster").onclick=()=>{generatePosterGraphic();const c=document.getElementById("posterCanvas"),a=document.createElement("a"),st=STATIONS.find(x=>x.id===Number(studioStation.value)),mode=document.getElementById("studioTemplate").value;a.download=`BYDRRM-RiverWatch-${mode}-${st.municipality}-${document.getElementById("studioFormat").value}.png`;a.href=c.toDataURL("image/png");a.click();};
document.getElementById("copyCaption").onclick=async()=>{const text=generateCaption();document.getElementById("captionPreview").textContent=text;try{await navigator.clipboard.writeText(text);alert("Caption copied.")}catch(e){alert("Copy failed. Select the caption manually.")}};

function populateLevelGuideStations(){
  const sel=document.getElementById("levelGuideStation");
  if(!sel) return;
  const current=sel.value||String(Number(document.getElementById("studioStation")?.value||STATIONS[0].id));
  sel.innerHTML=STATIONS.map(s=>`<option value="${s.id}">${s.name} — ${s.municipality}</option>`).join("");
  if([...sel.options].some(o=>o.value===current)) sel.value=current;
  updateLevelGuide();
}
function updateLevelGuide(){
  const sel=document.getElementById("levelGuideStation"); if(!sel) return;
  const id=Number(sel.value), p=thresholdFor(id), source=document.getElementById("levelGuideSource");
  const normal=document.getElementById("guideNormal"), watch=document.getElementById("guideWatch"), alarm=document.getElementById("guideAlarm"), critical=document.getElementById("guideCritical");
  if(verifiedThreshold(p)){
    const a=Number(p.alert), al=Number(p.alarm), c=Number(p.critical);
    normal.textContent=`< ${a.toFixed(2)} m`;
    watch.textContent=`${a.toFixed(2)}–<${al.toFixed(2)} m`;
    alarm.textContent=`${al.toFixed(2)}–<${c.toFixed(2)} m`;
    critical.textContent=`≥ ${c.toFixed(2)} m`;
    source.className="level-guide-source ok";
    source.textContent=`✓ Verified threshold profile • Source: ${p.source}`;
  }else{
    normal.textContent=watch.textContent=alarm.textContent=critical.textContent="—";
    source.className="level-guide-source warn";
    source.textContent="Official threshold values are not yet encoded for this station. Add only verified government values in Posting Studio; RiverWatch will not invent levels.";
  }
}

useLatestForStudio();loadThresholdEditor();selectSameMunicipality();updateStudioTemplateUI();
populateLevelGuideStations();
document.getElementById("levelGuideStation").onchange=updateLevelGuide;

render();
