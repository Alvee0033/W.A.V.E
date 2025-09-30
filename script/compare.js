(function(){
  if (typeof Cesium === 'undefined') { alert('Cesium failed to load.'); return; }

  const viewer = new Cesium.Viewer('cmpContainer', {
    imageryProvider: false,
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    timeline: false,
    animation: false,
    homeButton: false,
    sceneModePicker: false,
    baseLayerPicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    geocoder: false,
    infoBox: false,
    selectionIndicator: false
  });
  if (viewer && viewer.cesiumWidget && viewer.cesiumWidget.creditContainer) viewer.cesiumWidget.creditContainer.style.display = 'none';
  viewer.scene.globe.enableLighting = true;

  // Settings panel logic
  const cmpMenuButton = document.getElementById('cmpMenuButton');
  const cmpMenuPanel = document.getElementById('cmpMenuPanel');
  const cmpMenuClose = document.getElementById('cmpMenuClose');
  function closeOnOutside(event) {
    if (!cmpMenuPanel.contains(event.target) && !cmpMenuButton.contains(event.target)) {
      cmpMenuPanel.classList.add('hidden');
      document.removeEventListener('click', closeOnOutside);
    }
  }
  cmpMenuButton?.addEventListener('click', (e) => {
    e.stopPropagation();
    cmpMenuPanel.classList.toggle('hidden');
    if (!cmpMenuPanel.classList.contains('hidden')) {
      setTimeout(() => document.addEventListener('click', closeOnOutside), 0);
    }
  });
  cmpMenuClose?.addEventListener('click', () => cmpMenuPanel.classList.add('hidden'));

  const cmpBaseSel = document.getElementById('cmpBase');
  const cmpNdvi = document.getElementById('cmpNdvi');
  const cmpLst = document.getElementById('cmpLst');
  const cmpGedi = document.getElementById('cmpGedi');
  const cmpCO = document.getElementById('cmpCO');
  const cmpMISR = document.getElementById('cmpMISR');
  const cmpCloud = document.getElementById('cmpCloud');
  const cmpCeres = document.getElementById('cmpCeres');
  const cmpMopitt = document.getElementById('cmpMopitt');
  const cmpLabels = document.getElementById('cmpLabels');
  const cmpSettlements = document.getElementById('cmpSettlements');
  const cmpFrom = document.getElementById('cmpFrom');
  const cmpTo = document.getElementById('cmpTo');
  const cmpBuild = document.getElementById('cmpBuild');
  const cmpPlay = document.getElementById('cmpPlay');
  const cmpStatus = document.getElementById('cmpStatus');

  // Defaults: last 14 days
  const now = new Date();
  const past = new Date(now.getTime() - 13*24*60*60*1000);
  cmpTo.value = now.toISOString().slice(0,10);
  cmpFrom.value = past.toISOString().slice(0,10);

  // Base layer
  let baseLayer = null;
  function setBaseLayer(layerName, timeISO) {
    try { if (baseLayer) viewer.imageryLayers.remove(baseLayer, true); } catch(_) {}
    const provider = new Cesium.WebMapServiceImageryProvider({
      url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
      layers: layerName,
      parameters: { service: 'WMS', request: 'GetMap', version: '1.3.0', styles: '', format: 'image/png', transparent: false, time: (timeISO || cmpTo.value) },
      tilingScheme: new Cesium.GeographicTilingScheme()
    });
    baseLayer = viewer.imageryLayers.addImageryProvider(provider);
    baseLayer.alpha = 1.0; baseLayer.show = true;
  }
  setBaseLayer(cmpBaseSel.value);
  cmpBaseSel.addEventListener('change', () => setBaseLayer(cmpBaseSel.value));

  // Overlays
  const overlayFactories = {
    ndvi: (dateStr) => new Cesium.WebMapServiceImageryProvider({
      url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
      layers: 'MODIS_Terra_NDVI_8Day',
      parameters: { service: 'WMS', request: 'GetMap', version: '1.3.0', styles: '', format: 'image/png', transparent: true, time: dateStr },
      tilingScheme: new Cesium.GeographicTilingScheme()
    }),
    lst: (dateStr) => new Cesium.WebMapServiceImageryProvider({
      url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
      layers: 'MODIS_Terra_Land_Surface_Temp_Day',
      parameters: { service: 'WMS', request: 'GetMap', version: '1.3.0', styles: '', format: 'image/png', transparent: true, time: dateStr },
      tilingScheme: new Cesium.GeographicTilingScheme()
    }),
    gedi: (dateStr) => new Cesium.WebMapServiceImageryProvider({
      url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
      layers: 'GEDI_ISS_L4B_Aboveground_Biomass_Density_Mean_201904-202303',
      parameters: { service: 'WMS', request: 'GetMap', version: '1.3.0', styles: '', format: 'image/png', transparent: true, time: dateStr },
      tilingScheme: new Cesium.GeographicTilingScheme()
    }),
    co: (dateStr) => new Cesium.WebMapServiceImageryProvider({
      url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
      layers: 'AIRS_L2_Carbon_Monoxide_500hPa_Volume_Mixing_Ratio_Day',
      parameters: { service: 'WMS', request: 'GetMap', version: '1.3.0', styles: '', format: 'image/png', transparent: true, time: dateStr },
      tilingScheme: new Cesium.GeographicTilingScheme()
    }),
    mopitt: (dateStr) => new Cesium.WebMapServiceImageryProvider({
      url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
      layers: 'MOPITT_CO_Monthly_Total_Column_Day',
      parameters: { service: 'WMS', request: 'GetMap', version: '1.3.0', styles: '', format: 'image/png', transparent: true, crs: 'EPSG:4326', time: dateStr + 'T20:07:58Z' },
      tilingScheme: new Cesium.GeographicTilingScheme()
    }),
    misr: (dateStr) => new Cesium.WebMapServiceImageryProvider({
      url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
      layers: 'MISR_Radiance_Average_Infrared_Color_Monthly',
      parameters: { service: 'WMS', request: 'GetMap', version: '1.3.0', styles: '', format: 'image/png', transparent: true, time: dateStr },
      tilingScheme: new Cesium.GeographicTilingScheme()
    }),
    cloud: (dateStr) => new Cesium.WebMapServiceImageryProvider({
      url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
      layers: 'MODIS_Aqua_Cloud_Top_Pressure_Day',
      parameters: { service: 'WMS', request: 'GetMap', version: '1.3.0', styles: '', format: 'image/png', transparent: true, time: dateStr },
      tilingScheme: new Cesium.GeographicTilingScheme()
    }),
    ceres: (dateStr) => new Cesium.WebMapServiceImageryProvider({
      url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
      layers: 'CERES_EBAF_TOA_CRE_Longwave_Flux_Monthly',
      parameters: { service: 'WMS', request: 'GetMap', version: '1.3.0', styles: '', format: 'image/png', transparent: true, time: dateStr },
      tilingScheme: new Cesium.GeographicTilingScheme()
    }),
    labels: () => new Cesium.WebMapServiceImageryProvider({
      url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
      layers: 'Reference_Labels_15m',
      parameters: { service: 'WMS', request: 'GetMap', version: '1.3.0', styles: '', format: 'image/png', transparent: true },
      tilingScheme: new Cesium.GeographicTilingScheme()
    }),
    settlements: () => new Cesium.WebMapServiceImageryProvider({
      url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
      layers: 'GRUMP_Settlements',
      parameters: { service: 'WMS', request: 'GetMap', version: '1.3.0', styles: '', format: 'image/png', transparent: true },
      tilingScheme: new Cesium.GeographicTilingScheme()
    })
  };

  let overlayLayers = [];
  function clearOverlays() { try { overlayLayers.forEach(l => viewer.imageryLayers.remove(l, true)); } catch(_) {} overlayLayers = []; }

  function addSelectedOverlays(dateStr) {
    if (cmpNdvi?.checked) { const p = overlayFactories.ndvi(dateStr); const l = viewer.imageryLayers.addImageryProvider(p); l.alpha = 0.85; overlayLayers.push(l); }
    if (cmpLst?.checked) { const p = overlayFactories.lst(dateStr); const l = viewer.imageryLayers.addImageryProvider(p); l.alpha = 0.85; overlayLayers.push(l); }
    if (cmpGedi?.checked) { const p = overlayFactories.gedi(dateStr); const l = viewer.imageryLayers.addImageryProvider(p); l.alpha = 0.85; overlayLayers.push(l); }
    if (cmpCO?.checked) { const p = overlayFactories.co(dateStr); const l = viewer.imageryLayers.addImageryProvider(p); l.alpha = 0.85; overlayLayers.push(l); }
    if (cmpMISR?.checked) { const p = overlayFactories.misr(dateStr); const l = viewer.imageryLayers.addImageryProvider(p); l.alpha = 0.85; overlayLayers.push(l); }
    if (cmpCloud?.checked) { const p = overlayFactories.cloud(dateStr); const l = viewer.imageryLayers.addImageryProvider(p); l.alpha = 0.85; overlayLayers.push(l); }
    if (cmpCeres?.checked) { const p = overlayFactories.ceres(dateStr); const l = viewer.imageryLayers.addImageryProvider(p); l.alpha = 0.85; overlayLayers.push(l); }
    if (cmpMopitt?.checked) { const p = overlayFactories.mopitt(dateStr); const l = viewer.imageryLayers.addImageryProvider(p); l.alpha = 0.85; overlayLayers.push(l); }
    if (cmpLabels?.checked) { const p = overlayFactories.labels(); const l = viewer.imageryLayers.addImageryProvider(p); l.alpha = 1.0; overlayLayers.push(l); }
    if (cmpSettlements?.checked) { const p = overlayFactories.settlements(); const l = viewer.imageryLayers.addImageryProvider(p); l.alpha = 1.0; overlayLayers.push(l); }
  }

  // Generate date list (daily)
  function enumerateDates(fromStr, toStr) {
    const out = []; const from = new Date(fromStr); const to = new Date(toStr);
    if (isNaN(from) || isNaN(to) || from > to) return out;
    for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 86400000)) {
      out.push(d.toISOString().slice(0,10));
    }
    return out;
  }

  let frames = [];
  let currentIdx = 0;
  let playing = false;
  let playTimer = null;

  function currentDateForRender() {
    if (frames && frames.length > 0) {
      return frames[Math.max(0, Math.min(currentIdx, frames.length - 1))];
    }
    // fallback: use current To date
    return (cmpTo && cmpTo.value) ? cmpTo.value : (new Date()).toISOString().slice(0,10);
  }

  function refreshOverlaysForCurrentFrame() {
    const dateStr = currentDateForRender();
    clearOverlays();
    addSelectedOverlays(dateStr);
    try {
      cmpStatus.textContent = (frames.length ? `${currentIdx+1}/${frames.length} • ` : '') + dateStr;
    } catch(_) {}
  }

  function showFrame(idx) {
    if (idx < 0 || idx >= frames.length) return;
    currentIdx = idx;
    const dateStr = frames[currentIdx];
    // Base
    setBaseLayer(cmpBaseSel.value, dateStr);
    // Overlays
    clearOverlays();
    addSelectedOverlays(dateStr);
    cmpStatus.textContent = `${currentIdx+1}/${frames.length} • ${dateStr}`;
  }

  cmpBuild.addEventListener('click', () => {
    frames = enumerateDates(cmpFrom.value, cmpTo.value);
    if (!frames.length) { cmpStatus.textContent = 'Invalid date range'; return; }
    showFrame(0);
  });

  // Immediate response to toggle changes (match EARTH behavior)
  [cmpNdvi, cmpLst, cmpGedi, cmpCO, cmpMISR, cmpCloud, cmpCeres, cmpMopitt, cmpLabels, cmpSettlements]
    .forEach(el => el && el.addEventListener('change', refreshOverlaysForCurrentFrame));

  // Update base immediately
  cmpBaseSel?.addEventListener('change', () => {
    const dateStr = currentDateForRender();
    setBaseLayer(cmpBaseSel.value, dateStr);
    refreshOverlaysForCurrentFrame();
  });

  // React to date edits immediately (no Build needed for static preview)
  cmpFrom?.addEventListener('change', () => { frames = []; currentIdx = 0; refreshOverlaysForCurrentFrame(); });
  cmpTo?.addEventListener('change', () => { frames = []; currentIdx = 0; refreshOverlaysForCurrentFrame(); });

  // Initial paint using defaults
  refreshOverlaysForCurrentFrame();

  cmpPlay.addEventListener('click', () => {
    if (!frames.length) {
      frames = enumerateDates(cmpFrom.value, cmpTo.value);
      currentIdx = 0;
      if (!frames.length) { cmpStatus.textContent = 'Invalid date range'; return; }
    }
    if (playing) {
      clearInterval(playTimer); playing = false; cmpPlay.textContent = 'Play'; return;
    }
    playing = true; cmpPlay.textContent = 'Pause';
    playTimer = setInterval(() => {
      const next = (currentIdx + 1) % frames.length;
      showFrame(next);
    }, 400);
  });

  viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(0, 10, 25000000) });
})();


