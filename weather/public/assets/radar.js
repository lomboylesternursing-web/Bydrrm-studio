(() => {
  'use strict';

  const RADAR_BOUNDS = [[3.80912641587, 115.969111093], [22.322581275, 129.511990464]];
  const SATELLITE_BOUNDS = [[-1.0593208520000024, 103.99541937000095], [30.014531363000003, 147.02927158600028]];

  const layerConfig = {
    radar: {
      title: 'PAGASA RADAR MOSAIC', unit: 'QPE', export: 'RADAR MOSAIC · BULACAN', gradient: 'radar-gradient',
      labels: ['Light', 'Moderate', 'Heavy', 'Intense']
    },
    rain: {
      title: 'RADAR RAINFALL ESTIMATE', unit: 'mm/hr', export: 'RAIN RATE · BULACAN', gradient: 'rain-gradient',
      labels: ['Light', 'Moderate', 'Heavy', 'Intense']
    },
    ir: {
      title: 'ENHANCED INFRARED CLOUDS', unit: 'IR', export: 'INFRARED · BULACAN', gradient: 'ir-gradient',
      labels: ['Warmer cloud', 'Cooler', 'Very cold', 'Deep convection']
    },
    combined: {
      title: 'RADAR + INFRARED', unit: 'COMBINED', export: 'RADAR + IR · BULACAN', gradient: 'combined-gradient',
      labels: ['Cloud', 'Rain', 'Heavy', 'Convective']
    }
  };

  const fallbackBulacan = {
    type: 'Feature', properties: { name: 'Bulacan' }, geometry: { type: 'Polygon', coordinates: [[
      [121.3419,14.9973],[121.3454,14.8923],[121.2585,14.8413],[121.1824,14.8266],
      [121.1139,14.7597],[121.0077,14.7479],[120.9578,14.6875],[120.9169,14.6919],
      [120.84,14.7411],[120.6839,14.7703],[120.6199,14.7977],[120.7406,14.9507],
      [120.8148,14.9469],[120.8872,15.025],[120.8872,15.0878],[120.9272,15.1335],
      [120.918,15.2113],[121.0212,15.2524],[121.1439,15.2725],[121.2413,15.2043],
      [121.3118,15.1994],[121.3419,14.9973]
    ]]}}
  };

  const municipalityUrl = 'https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2011/geojson/municties/lowres/municities-province-17-bulacan.0.001.json';
  const map = L.map('map', { zoomControl: true, preferCanvas: true, attributionControl: true }).setView([15.03, 120.91], 9.35);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19, subdomains: 'abcd', crossOrigin: true,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }).addTo(map);

  const boundaryStyle = { color:'#fff', weight:1.35, opacity:.9, fillColor:'#66f2ad', fillOpacity:.035 };
  const outerStyle = { color:'#7dffb8', weight:3.2, opacity:1, fillColor:'#45cf8a', fillOpacity:.045 };
  let municipalityLayer = null;
  const outerLayer = L.geoJSON(fallbackBulacan, { style: outerStyle }).addTo(map);
  let bulacanBounds = outerLayer.getBounds();

  let activeLayer = 'radar';
  let liveRadarFrames = [];
  let liveIrFrames = [];
  let manualFrames = [];
  let manualOverride = false;
  let frameIndex = 0;
  let weatherOverlays = [];
  let playTimer = null;
  let lastLiveFetch = null;

  const $ = id => document.getElementById(id);
  const els = {
    frameFiles:$('frameFiles'), fileSummary:$('fileSummary'), slider:$('frameSlider'), timelineTime:$('timelineTime'),
    play:$('playFrames'), prev:$('prevFrame'), next:$('nextFrame'), opacity:$('weatherOpacity'),
    north:$('north'), south:$('south'), west:$('west'), east:$('east'), frameState:$('frameState'),
    legendTitle:$('legendTitle'), legendUnit:$('legendUnit'), legendGradient:$('legendGradient'), legendLabels:$('legendLabels'),
    exportLayerName:$('exportLayerName'), exportTime:$('exportTime'), exportDate:$('exportDate'), cleanExport:$('cleanExport'),
    savePng:$('savePng'), saveGif:$('saveGif'), exportNote:$('exportNote'), capture:$('captureZone'),
    clock:$('clock'), fitBulacan:$('fitBulacan'), refreshViewer:$('refreshViewer'), viewer:$('pagasaViewer')
  };

  function featureName(feature) {
    const p = feature?.properties || {};
    return p.NAME_3 || p.ADM3_EN || p.ADM3_NAME || p.name || p.NAME || p.MUNICITY || p.MUNICIPALITY || '';
  }

  fetch(municipalityUrl)
    .then(r => { if (!r.ok) throw new Error('boundary fetch failed'); return r.json(); })
    .then(data => {
      municipalityLayer = L.geoJSON(data, {
        style: boundaryStyle,
        onEachFeature: (feature, layer) => {
          const name = featureName(feature);
          if (name) layer.bindTooltip(name, { permanent:false, direction:'center', className:'muni-label' });
        }
      }).addTo(map);
      if (municipalityLayer.getBounds().isValid()) {
        bulacanBounds = municipalityLayer.getBounds();
        map.fitBounds(bulacanBounds.pad(.08));
      }
      outerLayer.bringToFront();
    })
    .catch(() => map.fitBounds(bulacanBounds.pad(.08)));

  function nowPht() {
    return new Date().toLocaleString('en-PH', { timeZone:'Asia/Manila', hour:'2-digit', minute:'2-digit', hour12:true })
      .replace(' am',' AM').replace(' pm',' PM');
  }
  function datePht(date = new Date()) {
    return new Intl.DateTimeFormat('en-PH', { timeZone:'Asia/Manila', day:'2-digit', month:'short', year:'numeric' }).format(date).toUpperCase();
  }
  function timePht(date = new Date()) {
    return new Intl.DateTimeFormat('en-PH', { timeZone:'Asia/Manila', hour:'2-digit', minute:'2-digit', hour12:true }).format(date);
  }
  function parsePagasaTime(value) {
    const m = String(value || '').match(/^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)$/i);
    if (!m) return new Date();
    const months = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
    let hour = Number(m[4]);
    if (m[6].toUpperCase() === 'PM' && hour !== 12) hour += 12;
    if (m[6].toUpperCase() === 'AM' && hour === 12) hour = 0;
    return new Date(`${m[3]}-${String(months[m[1][0].toUpperCase()+m[1].slice(1,3).toLowerCase()]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}T${String(hour).padStart(2,'0')}:${m[5]}:00+08:00`);
  }

  function updateClock() {
    els.clock.textContent = `${nowPht()} PHT`;
    if (!activeFrames().length) {
      els.exportTime.textContent = `${nowPht()} PHT`;
      els.exportDate.textContent = datePht();
    }
  }
  updateClock();
  setInterval(updateClock, 30000);

  function manualBounds() {
    return [[Number(els.south.value), Number(els.west.value)], [Number(els.north.value), Number(els.east.value)]];
  }

  function combinedFrames() {
    if (!liveRadarFrames.length || !liveIrFrames.length) return liveRadarFrames.map(r => ({ kind:'radar', radar:r, date:r.date, name:r.name }));
    const count = Math.min(liveRadarFrames.length, liveIrFrames.length);
    const radar = liveRadarFrames.slice(-count);
    const ir = liveIrFrames.slice(-count);
    return radar.map((r, i) => ({ kind:'combined', radar:r, ir:ir[i], date:r.date, name:r.name }));
  }

  function activeFrames() {
    if (manualOverride && manualFrames.length) return manualFrames;
    if (activeLayer === 'ir') return liveIrFrames;
    if (activeLayer === 'combined') return combinedFrames();
    return liveRadarFrames;
  }

  function setLayer(type) {
    stopPlayback();
    activeLayer = type;
    document.querySelectorAll('.layer-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.layer === type));
    const cfg = layerConfig[type];
    els.legendTitle.textContent = cfg.title;
    els.legendUnit.textContent = cfg.unit;
    els.exportLayerName.textContent = cfg.export;
    els.legendGradient.className = `legend-gradient ${cfg.gradient}`;
    els.legendLabels.innerHTML = cfg.labels.map(x => `<span>${x}</span>`).join('');
    syncTimeline(true);
  }
  document.querySelectorAll('.layer-btn').forEach(btn => btn.addEventListener('click', () => setLayer(btn.dataset.layer)));

  function clearWeatherOverlays() {
    weatherOverlays.forEach(layer => { try { map.removeLayer(layer); } catch (_) {} });
    weatherOverlays = [];
  }

  function addWeatherImage(url, bounds, opacity, zIndex) {
    const overlay = L.imageOverlay(url, bounds, { opacity, interactive:false, crossOrigin:true }).addTo(map);
    if (typeof overlay.setZIndex === 'function') overlay.setZIndex(zIndex);
    overlay.on('error', () => toast('A PAGASA image frame could not be loaded. Refreshing may help.'));
    weatherOverlays.push(overlay);
    return overlay;
  }

  function bringBoundariesFront() {
    if (municipalityLayer) municipalityLayer.bringToFront();
    outerLayer.bringToFront();
  }

  function showFrame(index, { quiet=false } = {}) {
    const frames = activeFrames();
    clearWeatherOverlays();
    if (!frames.length) {
      els.frameState.textContent = 'Loading official PAGASA weather frames…';
      els.frameState.style.display = '';
      els.timelineTime.textContent = 'Waiting for source';
      els.slider.min = '0'; els.slider.max = '0'; els.slider.value = '0';
      els.saveGif.disabled = true;
      return;
    }

    frameIndex = Math.max(0, Math.min(index, frames.length - 1));
    const frame = frames[frameIndex];
    const opacity = Number(els.opacity.value);

    if (manualOverride && frame.url) {
      addWeatherImage(frame.url, manualBounds(), opacity, 350);
    } else if (frame.kind === 'combined') {
      if (frame.ir?.url) addWeatherImage(frame.ir.url, SATELLITE_BOUNDS, Math.min(.66, opacity * .72), 330);
      if (frame.radar?.url) addWeatherImage(frame.radar.url, RADAR_BOUNDS, Math.min(.96, opacity + .08), 350);
    } else if (activeLayer === 'ir' || frame.kind === 'ir') {
      addWeatherImage(frame.url, SATELLITE_BOUNDS, opacity, 340);
    } else {
      addWeatherImage(frame.url, RADAR_BOUNDS, opacity, 350);
    }

    bringBoundariesFront();
    els.frameState.style.display = 'none';
    els.slider.min = '0'; els.slider.max = String(Math.max(0, frames.length - 1)); els.slider.value = String(frameIndex);
    els.saveGif.disabled = frames.length < 2;
    els.timelineTime.textContent = `${frameIndex + 1}/${frames.length} · ${frame.name || 'Weather frame'}`;

    const stamp = frame.date instanceof Date && !Number.isNaN(frame.date.getTime()) ? frame.date : new Date();
    els.exportTime.textContent = `${timePht(stamp)} PHT`;
    els.exportDate.textContent = datePht(stamp);
    if (!quiet) map.invalidateSize();
  }

  function syncTimeline(toLatest=false) {
    const frames = activeFrames();
    if (!frames.length) return showFrame(0);
    if (toLatest || frameIndex >= frames.length) frameIndex = frames.length - 1;
    showFrame(frameIndex);
  }

  function liveImageProxy(url, refreshKey) {
    return `/api/pagasa?action=image&url=${encodeURIComponent(url)}&v=${refreshKey}`;
  }

  async function loadLiveSources({ announce=false } = {}) {
    const refreshKey = Math.floor(Date.now() / 60000);
    els.frameState.textContent = 'Loading live PAGASA radar mosaic…';
    els.frameState.style.display = '';
    try {
      const response = await fetch(`/api/pagasa?action=timeline&v=${refreshKey}`, { cache:'no-store' });
      if (!response.ok) throw new Error(`Source HTTP ${response.status}`);
      const data = await response.json();
      const radar = Array.isArray(data.rainfall_estimate) ? data.rainfall_estimate : [];
      liveRadarFrames = radar.map(item => ({
        kind:'radar', name:item.time || 'PAGASA Radar QPE', date:parsePagasaTime(item.time),
        url:liveImageProxy(item.url, refreshKey), sourceUrl:item.url
      }));

      const irSequence = [6,5,4,3,2,1];
      liveIrFrames = irSequence.map((sourceFrame, i) => ({
        kind:'ir', name:`Himawari IR · ${i + 1}/${irSequence.length}`, date:new Date(),
        url:`/api/pagasa?action=satellite&product=himawari&frame=${sourceFrame}&v=${refreshKey}`
      }));

      lastLiveFetch = new Date();
      if (!manualOverride) {
        els.fileSummary.textContent = `LIVE · ${liveRadarFrames.length} PAGASA radar frames + ${liveIrFrames.length} Himawari IR frames`;
        syncTimeline(true);
      }
      if (announce) toast('Latest PAGASA weather frames loaded.');
    } catch (error) {
      console.error(error);
      if (!manualOverride) {
        els.fileSummary.textContent = 'Live PAGASA feed temporarily unavailable · manual frame fallback is ready';
        els.frameState.textContent = 'Live source unavailable — use official viewer or load frames manually';
        els.frameState.style.display = '';
      }
      if (announce) toast('Live PAGASA feed is temporarily unavailable.');
    }
  }

  function setManualFrames(files) {
    manualFrames.forEach(f => { if (f.objectUrl) URL.revokeObjectURL(f.objectUrl); });
    manualFrames = Array.from(files)
      .sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric:true }))
      .map(file => {
        const objectUrl = URL.createObjectURL(file);
        return { kind:'manual', name:file.name, url:objectUrl, objectUrl, date:file.lastModified ? new Date(file.lastModified) : new Date() };
      });
    manualOverride = manualFrames.length > 0;
    if (manualOverride) {
      els.fileSummary.textContent = `MANUAL FALLBACK · ${manualFrames.length} frame${manualFrames.length === 1 ? '' : 's'} loaded`;
      frameIndex = 0;
      showFrame(0);
    } else {
      manualOverride = false;
      syncTimeline(true);
    }
  }

  els.frameFiles.addEventListener('change', e => setManualFrames(e.target.files || []));
  els.slider.addEventListener('input', () => showFrame(Number(els.slider.value)));
  els.prev.addEventListener('click', () => {
    const frames = activeFrames(); if (!frames.length) return;
    showFrame((frameIndex - 1 + frames.length) % frames.length);
  });
  els.next.addEventListener('click', () => {
    const frames = activeFrames(); if (!frames.length) return;
    showFrame((frameIndex + 1) % frames.length);
  });

  function stopPlayback() {
    if (playTimer) clearInterval(playTimer);
    playTimer = null;
    els.play.textContent = '▶ Play';
  }
  els.play.addEventListener('click', () => {
    if (playTimer) return stopPlayback();
    const frames = activeFrames();
    if (frames.length < 2) return toast('At least 2 frames are needed for animation.');
    els.play.textContent = '❚❚ Pause';
    playTimer = setInterval(() => {
      const nowFrames = activeFrames();
      if (!nowFrames.length) return stopPlayback();
      showFrame((frameIndex + 1) % nowFrames.length, { quiet:true });
    }, 850);
  });

  els.opacity.addEventListener('input', () => showFrame(frameIndex, { quiet:true }));
  [els.north,els.south,els.west,els.east].forEach(input => input.addEventListener('change', () => {
    if (manualOverride) showFrame(frameIndex, { quiet:true });
  }));
  els.fitBulacan.addEventListener('click', () => map.fitBounds(bulacanBounds.pad(.08)));
  els.refreshViewer.addEventListener('click', async () => {
    manualOverride = false;
    els.frameFiles.value = '';
    els.viewer.src = els.viewer.src.split('#')[0];
    await loadLiveSources({ announce:true });
  });

  function toast(message) {
    document.querySelector('.toast')?.remove();
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = message; document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  function downloadDataUrl(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  }
  function filename(ext) {
    const stamp = new Date().toLocaleString('sv-SE',{timeZone:'Asia/Manila'}).replace(/[: ]/g,'-').slice(0,16);
    return `BYDRRM-Bulacan-${activeLayer}-${stamp}.${ext}`;
  }

  async function waitForMapImages(timeout=6000) {
    const imgs = [...els.capture.querySelectorAll('img')].filter(img => !img.complete);
    if (!imgs.length) return;
    await Promise.race([
      Promise.all(imgs.map(img => new Promise(resolve => {
        img.addEventListener('load', resolve, { once:true });
        img.addEventListener('error', resolve, { once:true });
      }))),
      new Promise(resolve => setTimeout(resolve, timeout))
    ]);
  }

  async function captureCurrent(scale=2) {
    if (!window.html2canvas) throw new Error('PNG renderer did not load');
    document.body.classList.add('is-exporting');
    if (els.cleanExport.checked) document.body.classList.add('clean-export');
    await waitForMapImages();
    await new Promise(r => setTimeout(r, 180));
    try {
      return await html2canvas(els.capture, { useCORS:true, allowTaint:false, backgroundColor:'#071018', scale, logging:false, imageTimeout:12000 });
    } finally {
      document.body.classList.remove('is-exporting','clean-export');
    }
  }

  els.savePng.addEventListener('click', async () => {
    els.savePng.disabled = true; els.exportNote.textContent = 'Rendering PNG…';
    try {
      const canvas = await captureCurrent(2);
      downloadDataUrl(canvas.toDataURL('image/png'), filename('png'));
      toast('PNG ready.');
      els.exportNote.textContent = 'PNG exported with BYDRRM logo, legend, source and timestamp.';
    } catch (error) {
      console.error(error);
      els.exportNote.textContent = 'PNG export could not finish. Refresh the live source and try again.';
      toast('PNG export could not finish.');
    } finally { els.savePng.disabled = false; }
  });

  els.saveGif.addEventListener('click', async () => {
    const frames = activeFrames();
    if (frames.length < 2) return toast('At least 2 frames are needed for GIF export.');
    if (!window.gifshot) return toast('GIF encoder did not load.');
    stopPlayback();
    els.saveGif.disabled = true;
    const original = frameIndex;
    const indexes = Array.from({ length:Math.min(frames.length,12) }, (_,i) => i);
    const images = [];
    try {
      for (let n=0; n<indexes.length; n++) {
        els.exportNote.textContent = `Rendering GIF frame ${n + 1}/${indexes.length}…`;
        showFrame(indexes[n], { quiet:true });
        await new Promise(r => setTimeout(r, 450));
        const canvas = await captureCurrent(1);
        images.push(canvas.toDataURL('image/png'));
      }
      showFrame(original, { quiet:true });
      els.exportNote.textContent = 'Encoding GIF…';
      gifshot.createGIF({
        images, gifWidth:Math.round(els.capture.clientWidth), gifHeight:Math.round(els.capture.clientHeight),
        interval:.75, numFrames:images.length, frameDuration:1, sampleInterval:10
      }, result => {
        if (!result.error) {
          downloadDataUrl(result.image, filename('gif'));
          toast('Animated GIF ready.');
          els.exportNote.textContent = `GIF exported from ${images.length} official/live frame${images.length===1?'':'s'}.`;
        } else {
          console.error(result.errorMsg || result);
          els.exportNote.textContent = 'GIF encoder could not complete this export.';
          toast('GIF export failed.');
        }
        els.saveGif.disabled = activeFrames().length < 2;
      });
    } catch (error) {
      console.error(error);
      showFrame(original, { quiet:true });
      els.saveGif.disabled = activeFrames().length < 2;
      els.exportNote.textContent = 'GIF export could not finish. Refresh the live source and retry.';
      toast('GIF export could not finish.');
    }
  });

  els.north.value = '22.322581275';
  els.south.value = '3.809126416';
  els.west.value = '115.969111093';
  els.east.value = '129.511990464';
  els.saveGif.disabled = true;
  setLayer('radar');
  setTimeout(() => map.invalidateSize(), 150);
  loadLiveSources();
  setInterval(() => { if (!manualOverride) loadLiveSources(); }, 5 * 60 * 1000);
})();
