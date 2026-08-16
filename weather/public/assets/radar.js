(() => {
  'use strict';

  const layerConfig = {
    radar: {
      title: 'RADAR REFLECTIVITY', unit: 'dBZ', export: 'RADAR · BULACAN', gradient: 'radar-gradient',
      labels: ['Light', 'Moderate', 'Heavy', 'Extreme']
    },
    rain: {
      title: 'RADAR RAIN RATE', unit: 'mm/hr', export: 'RAIN RATE · BULACAN', gradient: 'rain-gradient',
      labels: ['Light', 'Moderate', 'Heavy', 'Extreme']
    },
    ir: {
      title: 'INFRARED CLOUD TOP', unit: '°C', export: 'INFRARED · BULACAN', gradient: 'ir-gradient',
      labels: ['Warmer', '-43°', '-63°', '≤ -73°']
    },
    combined: {
      title: 'RADAR + INFRARED', unit: 'COMBINED', export: 'RADAR + IR · BULACAN', gradient: 'combined-gradient',
      labels: ['Cloud', 'Rain', 'Heavy', 'Convective']
    }
  };

  const fallbackBulacan = {
    type: 'Feature',
    properties: { name: 'Bulacan' },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [121.3419,14.9973],[121.3454,14.8923],[121.2585,14.8413],[121.1824,14.8266],
        [121.1139,14.7597],[121.0077,14.7479],[120.9578,14.6875],[120.9169,14.6919],
        [120.84,14.7411],[120.6839,14.7703],[120.6199,14.7977],[120.7406,14.9507],
        [120.8148,14.9469],[120.8872,15.025],[120.8872,15.0878],[120.9272,15.1335],
        [120.918,15.2113],[121.0212,15.2524],[121.1439,15.2725],[121.2413,15.2043],
        [121.3118,15.1994],[121.3419,14.9973]
      ]]
    }
  };

  const municipalityUrl = 'https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2011/geojson/municties/lowres/municities-province-17-bulacan.0.001.json';

  const map = L.map('map', { zoomControl: true, preferCanvas: true, attributionControl: true })
    .setView([15.03, 120.91], 9.35);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
    crossOrigin: true,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }).addTo(map);

  const boundaryStyle = {
    color: '#ffffff', weight: 1.35, opacity: 0.9, fillColor: '#66f2ad', fillOpacity: 0.035
  };
  const outerStyle = {
    color: '#7dffb8', weight: 3.2, opacity: 1, fillColor: '#45cf8a', fillOpacity: 0.045
  };

  let municipalityLayer = null;
  const outerLayer = L.geoJSON(fallbackBulacan, { style: outerStyle }).addTo(map);
  let bulacanBounds = outerLayer.getBounds();
  let activeLayer = 'radar';
  let frames = [];
  let frameIndex = 0;
  let weatherOverlay = null;
  let playTimer = null;

  const $ = id => document.getElementById(id);
  const els = {
    frameFiles: $('frameFiles'), fileSummary: $('fileSummary'), slider: $('frameSlider'), timelineTime: $('timelineTime'),
    play: $('playFrames'), prev: $('prevFrame'), next: $('nextFrame'), opacity: $('weatherOpacity'),
    north: $('north'), south: $('south'), west: $('west'), east: $('east'), frameState: $('frameState'),
    legendTitle: $('legendTitle'), legendUnit: $('legendUnit'), legendGradient: $('legendGradient'), legendLabels: $('legendLabels'),
    exportLayerName: $('exportLayerName'), exportTime: $('exportTime'), exportDate: $('exportDate'), cleanExport: $('cleanExport'),
    savePng: $('savePng'), saveGif: $('saveGif'), exportNote: $('exportNote'), capture: $('captureZone'),
    clock: $('clock'), fitBulacan: $('fitBulacan'), refreshViewer: $('refreshViewer'), viewer: $('pagasaViewer')
  };

  function featureName(feature) {
    const p = feature && feature.properties ? feature.properties : {};
    return p.NAME_3 || p.ADM3_EN || p.ADM3_NAME || p.name || p.NAME || p.MUNICITY || p.MUNICIPALITY || '';
  }

  fetch(municipalityUrl)
    .then(r => { if (!r.ok) throw new Error('boundary fetch failed'); return r.json(); })
    .then(data => {
      municipalityLayer = L.geoJSON(data, {
        style: boundaryStyle,
        onEachFeature: (feature, layer) => {
          const name = featureName(feature);
          if (name) layer.bindTooltip(name, { permanent: false, direction: 'center', className: 'muni-label' });
        }
      }).addTo(map);
      if (municipalityLayer.getBounds().isValid()) {
        bulacanBounds = municipalityLayer.getBounds();
        map.fitBounds(bulacanBounds.pad(0.08));
      }
      outerLayer.bringToFront();
    })
    .catch(() => map.fitBounds(bulacanBounds.pad(0.08)));

  function nowPht() {
    return new Date().toLocaleString('en-PH', {
      timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true
    }).replace(' am',' AM').replace(' pm',' PM');
  }

  function datePht(date = new Date()) {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila', day: '2-digit', month: 'short', year: 'numeric'
    }).format(date).toUpperCase();
  }

  function updateClock() {
    els.clock.textContent = `${nowPht()} PHT`;
    if (!frames.length) {
      els.exportTime.textContent = `${nowPht()} PHT`;
      els.exportDate.textContent = datePht();
    }
  }
  updateClock();
  setInterval(updateClock, 30000);

  function setLayer(type) {
    activeLayer = type;
    document.querySelectorAll('.layer-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.layer === type));
    const cfg = layerConfig[type];
    els.legendTitle.textContent = cfg.title;
    els.legendUnit.textContent = cfg.unit;
    els.exportLayerName.textContent = cfg.export;
    els.legendGradient.className = `legend-gradient ${cfg.gradient}`;
    els.legendLabels.innerHTML = cfg.labels.map(x => `<span>${x}</span>`).join('');
  }

  document.querySelectorAll('.layer-btn').forEach(btn => btn.addEventListener('click', () => setLayer(btn.dataset.layer)));

  function overlayBounds() {
    const north = Number(els.north.value), south = Number(els.south.value), west = Number(els.west.value), east = Number(els.east.value);
    return [[south, west], [north, east]];
  }

  function clearOverlay() {
    if (weatherOverlay) {
      map.removeLayer(weatherOverlay);
      weatherOverlay = null;
    }
  }

  function showFrame(index, { quiet = false } = {}) {
    if (!frames.length) {
      clearOverlay();
      els.frameState.textContent = 'No external weather frame loaded';
      els.frameState.style.display = '';
      els.timelineTime.textContent = 'No frame';
      return;
    }
    frameIndex = Math.max(0, Math.min(index, frames.length - 1));
    clearOverlay();
    const frame = frames[frameIndex];
    weatherOverlay = L.imageOverlay(frame.url, overlayBounds(), {
      opacity: Number(els.opacity.value), interactive: false, crossOrigin: false, zIndex: 350
    }).addTo(map);
    if (municipalityLayer) municipalityLayer.bringToFront();
    outerLayer.bringToFront();
    els.frameState.style.display = 'none';
    els.slider.value = String(frameIndex);
    els.timelineTime.textContent = `${frameIndex + 1}/${frames.length} · ${frame.name}`;
    const stamp = frame.date || new Date();
    els.exportTime.textContent = `${new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit',hour12:true}).format(stamp)} PHT`;
    els.exportDate.textContent = datePht(stamp);
    if (!quiet) map.invalidateSize();
  }

  function setFrames(files) {
    frames.forEach(f => URL.revokeObjectURL(f.url));
    frames = Array.from(files)
      .sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      .map(file => ({ name: file.name, url: URL.createObjectURL(file), date: file.lastModified ? new Date(file.lastModified) : new Date() }));
    els.slider.min = '0';
    els.slider.max = String(Math.max(0, frames.length - 1));
    els.slider.value = '0';
    els.fileSummary.textContent = frames.length ? `${frames.length} frame${frames.length === 1 ? '' : 's'} loaded · sorted by filename` : 'No frames selected';
    els.saveGif.disabled = frames.length < 2;
    frameIndex = 0;
    showFrame(0);
  }

  els.frameFiles.addEventListener('change', e => setFrames(e.target.files || []));
  els.slider.addEventListener('input', () => showFrame(Number(els.slider.value)));
  els.prev.addEventListener('click', () => showFrame((frameIndex - 1 + Math.max(1,frames.length)) % Math.max(1,frames.length)));
  els.next.addEventListener('click', () => showFrame((frameIndex + 1) % Math.max(1,frames.length)));

  function stopPlayback() {
    if (playTimer) clearInterval(playTimer);
    playTimer = null;
    els.play.textContent = '▶ Play';
  }

  els.play.addEventListener('click', () => {
    if (playTimer) return stopPlayback();
    if (frames.length < 2) return toast('Load at least 2 chronological frames for animation.');
    els.play.textContent = '❚❚ Pause';
    playTimer = setInterval(() => showFrame((frameIndex + 1) % frames.length, { quiet: true }), 750);
  });

  els.opacity.addEventListener('input', () => { if (weatherOverlay) weatherOverlay.setOpacity(Number(els.opacity.value)); });
  [els.north,els.south,els.west,els.east].forEach(input => input.addEventListener('change', () => showFrame(frameIndex, { quiet: true })));
  els.fitBulacan.addEventListener('click', () => map.fitBounds(bulacanBounds.pad(0.08)));
  els.refreshViewer.addEventListener('click', () => { els.viewer.src = els.viewer.src.split('#')[0]; toast('Official PAGASA viewer refreshed.'); });

  function toast(message) {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = message; document.body.appendChild(el);
    setTimeout(() => el.remove(), 2800);
  }

  function downloadDataUrl(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  }

  function filename(ext) {
    const stamp = new Date().toLocaleString('sv-SE',{timeZone:'Asia/Manila'}).replace(/[: ]/g,'-').slice(0,16);
    return `BYDRRM-Bulacan-${activeLayer}-${stamp}.${ext}`;
  }

  async function captureCurrent(scale = 2) {
    if (!window.html2canvas) throw new Error('PNG renderer did not load');
    document.body.classList.add('is-exporting');
    if (els.cleanExport.checked) document.body.classList.add('clean-export');
    await new Promise(r => setTimeout(r, 180));
    try {
      return await html2canvas(els.capture, {
        useCORS: true, allowTaint: false, backgroundColor: '#071018', scale,
        logging: false, imageTimeout: 12000
      });
    } finally {
      document.body.classList.remove('is-exporting');
      document.body.classList.remove('clean-export');
    }
  }

  els.savePng.addEventListener('click', async () => {
    els.savePng.disabled = true;
    els.exportNote.textContent = 'Rendering PNG…';
    try {
      const canvas = await captureCurrent(2);
      downloadDataUrl(canvas.toDataURL('image/png'), filename('png'));
      toast('PNG ready.');
      els.exportNote.textContent = 'PNG exported with BYDRRM branding, legend and timestamp.';
    } catch (err) {
      console.error(err);
      els.exportNote.textContent = 'Export blocked by a remote map/image security policy. Try a locally loaded PAGASA frame.';
      toast('PNG export could not finish.');
    } finally { els.savePng.disabled = false; }
  });

  els.saveGif.addEventListener('click', async () => {
    if (frames.length < 2) return toast('Load at least 2 frames first.');
    if (!window.gifshot) return toast('GIF renderer did not load.');
    stopPlayback();
    els.saveGif.disabled = true;
    const original = frameIndex;
    const indexes = Array.from({length: Math.min(frames.length, 12)}, (_, i) => i);
    const images = [];
    try {
      for (let n = 0; n < indexes.length; n++) {
        els.exportNote.textContent = `Rendering GIF frame ${n + 1}/${indexes.length}…`;
        showFrame(indexes[n], { quiet: true });
        await new Promise(r => setTimeout(r, 220));
        const canvas = await captureCurrent(1);
        images.push(canvas.toDataURL('image/png'));
      }
      showFrame(original, { quiet: true });
      els.exportNote.textContent = 'Encoding GIF…';
      gifshot.createGIF({
        images,
        gifWidth: Math.round(els.capture.clientWidth),
        gifHeight: Math.round(els.capture.clientHeight),
        interval: 0.7,
        numFrames: images.length,
        frameDuration: 1,
        sampleInterval: 10
      }, result => {
        if (!result.error) {
          downloadDataUrl(result.image, filename('gif'));
          toast('Animated GIF ready.');
          els.exportNote.textContent = `GIF exported from ${images.length} frame${images.length===1?'':'s'}.`;
        } else {
          console.error(result.errorMsg || result);
          els.exportNote.textContent = 'GIF encoder could not complete this export.';
          toast('GIF export failed.');
        }
        els.saveGif.disabled = false;
      });
    } catch (err) {
      console.error(err);
      showFrame(original, { quiet: true });
      els.saveGif.disabled = false;
      els.exportNote.textContent = 'GIF export was blocked by a remote map/image security policy.';
      toast('GIF export could not finish.');
    }
  });

  els.saveGif.disabled = true;
  setLayer('radar');
  setTimeout(() => map.invalidateSize(), 150);
})();
