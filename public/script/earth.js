(function() {
  const menuBtn = document.getElementById('menuButton');
  const menuPanel = document.getElementById('menuPanel');
  function closeOnOutside(event) {
    if (!menuPanel.contains(event.target) && !menuBtn.contains(event.target)) {
      menuPanel.classList.add('hidden');
      document.removeEventListener('click', closeOnOutside);
    }
  }
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menuPanel.classList.toggle('hidden');
    if (!menuPanel.classList.contains('hidden')) {
      setTimeout(() => document.addEventListener('click', closeOnOutside), 0);
    }
  });

  if (typeof Cesium === 'undefined') {
    alert('Cesium failed to load. Check your network.');
    return;
  }

  const viewer = new Cesium.Viewer('cesiumContainer', {
    imageryProvider: false,
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    timeline: false,
    animation: false,
    homeButton: false,
    sceneModePicker: false,
    baseLayerPicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    vrButton: false,
    geocoder: false,
    infoBox: false,
    selectionIndicator: false
  });

  if (viewer && viewer.cesiumWidget && viewer.cesiumWidget.creditContainer) {
    viewer.cesiumWidget.creditContainer.style.display = 'none';
  }

  let autoRotateEnabled = true;
  const rotateRadiansPerSec = Cesium.Math.toRadians(2.0);
  function autoRotateTick(clock) {
    if (!autoRotateEnabled) return;
    const dt = clock.deltaTime || 0;
    const dLon = rotateRadiansPerSec * dt;
    try {
      const cam = viewer.camera;
      const c = cam.positionCartographic.clone();
      const newLon = c.longitude + dLon;
      cam.setView({
        destination: Cesium.Cartesian3.fromRadians(newLon, c.latitude, c.height),
        orientation: { heading: cam.heading, pitch: cam.pitch, roll: cam.roll }
      });
    } catch (_) {}
  }
  viewer.clock.onTick.addEventListener(autoRotateTick);

  const inputHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
  inputHandler.setInputAction(() => { autoRotateEnabled = false; }, Cesium.ScreenSpaceEventType.WHEEL);
  inputHandler.setInputAction(() => { autoRotateEnabled = false; }, Cesium.ScreenSpaceEventType.PINCH_START);
  inputHandler.setInputAction(() => { autoRotateEnabled = false; }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
  inputHandler.setInputAction(() => { autoRotateEnabled = false; }, Cesium.ScreenSpaceEventType.RIGHT_DOWN);

  const bmngDate = '2025-09-25';
  const baseBmngWms = new Cesium.WebMapServiceImageryProvider({
    url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
    layers: 'BlueMarble_NextGeneration',
    parameters: {
      service: 'WMS',
      request: 'GetMap',
      version: '1.3.0',
      styles: '',
      format: 'image/png',
      transparent: false,
      time: bmngDate
    },
    tilingScheme: new Cesium.GeographicTilingScheme()
  });
  const baseBmngLayer = viewer.imageryLayers.addImageryProvider(baseBmngWms);
  baseBmngLayer.alpha = 1.0;
  baseBmngLayer.show = true;

  const labelsProvider = new Cesium.WebMapServiceImageryProvider({
    url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
    layers: 'Reference_Labels_15m',
    parameters: { service: 'WMS', request: 'GetMap', version: '1.3.0', styles: '', format: 'image/png', transparent: true },
    tilingScheme: new Cesium.GeographicTilingScheme()
  });
  const labelsLayer = viewer.imageryLayers.addImageryProvider(labelsProvider);
  labelsLayer.alpha = 1.0;
  labelsLayer.show = true;

  const settlementsProvider = new Cesium.WebMapServiceImageryProvider({
    url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
    layers: 'GRUMP_Settlements',
    parameters: { service: 'WMS', request: 'GetMap', version: '1.3.0', styles: '', format: 'image/png', transparent: true },
    tilingScheme: new Cesium.GeographicTilingScheme()
  });
  const settlementsLayer = viewer.imageryLayers.addImageryProvider(settlementsProvider);
  settlementsLayer.alpha = 1.0;
  settlementsLayer.show = false;

  const cloudPressureProvider = new Cesium.WebMapServiceImageryProvider({
    url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
    layers: 'MODIS_Aqua_Cloud_Top_Pressure_Day',
    parameters: { service: 'WMS', request: 'GetMap', version: '1.3.0', styles: '', format: 'image/png', transparent: true },
    tilingScheme: new Cesium.GeographicTilingScheme()
  });
  const cloudPressureLayer = viewer.imageryLayers.addImageryProvider(cloudPressureProvider);
  cloudPressureLayer.alpha = 1.0;
  cloudPressureLayer.show = false;

  const ceresFluxProvider = new Cesium.WebMapServiceImageryProvider({
    url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
    layers: 'CERES_EBAF_TOA_CRE_Longwave_Flux_Monthly',
    parameters: { service: 'WMS', request: 'GetMap', version: '1.3.0', styles: '', format: 'image/png', transparent: true },
    tilingScheme: new Cesium.GeographicTilingScheme()
  });
  const ceresFluxLayer = viewer.imageryLayers.addImageryProvider(ceresFluxProvider);
  ceresFluxLayer.alpha = 1.0;
  ceresFluxLayer.show = false;

  const mopittProvider = new Cesium.WebMapServiceImageryProvider({
    url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
    layers: 'MOPITT_CO_Monthly_Total_Column_Day',
    parameters: { 
      service: 'WMS', 
      request: 'GetMap', 
      version: '1.3.0', 
      styles: '', 
      format: 'image/png', 
      transparent: true,
      crs: 'EPSG:4326',
      time: '2024-09-29T20:07:58Z'
    },
    tilingScheme: new Cesium.GeographicTilingScheme()
  });
  const mopittLayer = viewer.imageryLayers.addImageryProvider(mopittProvider);
  mopittLayer.alpha = 1.0;
  mopittLayer.show = false;

  const ndviDate = '2025-09-21';
  const statusEl = document.getElementById('status');
  const ndviWmsProvider = new Cesium.WebMapServiceImageryProvider({
    url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
    layers: 'MODIS_Terra_NDVI_8Day',
    parameters: {
      service: 'WMS',
      request: 'GetMap',
      version: '1.3.0',
      styles: '',
      format: 'image/png',
      transparent: true,
      time: ndviDate
    },
    tilingScheme: new Cesium.GeographicTilingScheme()
  });
  const ndviWmsLayer = viewer.imageryLayers.addImageryProvider(ndviWmsProvider);
  ndviWmsLayer.alpha = 0.85;
  ndviWmsLayer.show = false;

  const lstDate = '2025-09-29';
  const lstWmsProvider = new Cesium.WebMapServiceImageryProvider({
    url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
    layers: 'MODIS_Terra_Land_Surface_Temp_Day',
    parameters: {
      service: 'WMS',
      request: 'GetMap',
      version: '1.3.0',
      styles: '',
      format: 'image/png',
      transparent: true,
      time: lstDate
    },
    tilingScheme: new Cesium.GeographicTilingScheme()
  });
  const lstWmsLayer = viewer.imageryLayers.addImageryProvider(lstWmsProvider);
  lstWmsLayer.alpha = 0.85;
  lstWmsLayer.show = false;

  const gediDate = '2022-11-15';
  const gediLayerName = 'GEDI_ISS_L4B_Aboveground_Biomass_Density_Mean_201904-202303';
  const gediWmsProvider = new Cesium.WebMapServiceImageryProvider({
    url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
    layers: gediLayerName,
    parameters: {
      service: 'WMS',
      request: 'GetMap',
      version: '1.3.0',
      styles: '',
      format: 'image/png',
      transparent: true,
      time: gediDate
    },
    tilingScheme: new Cesium.GeographicTilingScheme()
  });
  const gediWmsLayer = viewer.imageryLayers.addImageryProvider(gediWmsProvider);
  gediWmsLayer.alpha = 0.85;
  gediWmsLayer.show = false;

  const coDateTime = '2025-06-30T02:30:00Z';
  const coLayerName = 'AIRS_L2_Carbon_Monoxide_500hPa_Volume_Mixing_Ratio_Day';
  const coWmsProvider = new Cesium.WebMapServiceImageryProvider({
    url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
    layers: coLayerName,
    parameters: {
      service: 'WMS',
      request: 'GetMap',
      version: '1.3.0',
      styles: '',
      format: 'image/png',
      transparent: true,
      time: coDateTime
    },
    tilingScheme: new Cesium.GeographicTilingScheme()
  });
  const coWmsLayer = viewer.imageryLayers.addImageryProvider(coWmsProvider);
  coWmsLayer.alpha = 0.85;
  coWmsLayer.show = false;

  const misrDateTime = '2019-09-07T15:25:24Z';
  const misrLayerName = 'MISR_Radiance_Average_Infrared_Color_Monthly';
  const misrWmsProvider = new Cesium.WebMapServiceImageryProvider({
    url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
    layers: misrLayerName,
    parameters: {
      service: 'WMS',
      request: 'GetMap',
      version: '1.3.0',
      styles: '',
      format: 'image/png',
      transparent: true,
      time: misrDateTime
    },
    tilingScheme: new Cesium.GeographicTilingScheme()
  });
  const misrWmsLayer = viewer.imageryLayers.addImageryProvider(misrWmsProvider);
  misrWmsLayer.alpha = 0.85;
  misrWmsLayer.show = false;

  let imergWmsLayer = null;
  function addOrUpdateIMERGLayer(dateISO) {
    const timeStr = (new Date(dateISO)).toISOString().slice(0,10);
    try { if (imergWmsLayer) { viewer.imageryLayers.remove(imergWmsLayer, false); imergWmsLayer = null; } } catch(_) {}
    const imergProvider = new Cesium.WebMapServiceImageryProvider({
      url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
      layers: 'IMERG_Precipitation_Rate_30min',
      parameters: { service: 'WMS', request: 'GetMap', version: '1.3.0', styles: '', format: 'image/png', transparent: true, time: timeStr },
      tilingScheme: new Cesium.GeographicTilingScheme()
    });
    imergWmsLayer = viewer.imageryLayers.addImageryProvider(imergProvider);
    imergWmsLayer.alpha = 0.8;
    imergWmsLayer.show = true;
    try { viewer.imageryLayers.raiseToTop(imergWmsLayer); } catch(_) {}
    showLayerNote('imerg', `IMERG — Precipitation rate (30‑min) at ${timeStr}.`);
  }

  const LEGEND_HIDE_HEIGHT = 15000000;
  const legendAnchor = { lon: null, lat: null };
  function updateLegend() {
    const legend = document.getElementById('imergLegend');
    if (legendAnchor.lon === null || legendAnchor.lat === null) { legend.classList.add('hidden'); return; }
    const height = viewer.camera.positionCartographic.height;
    if (height > LEGEND_HIDE_HEIGHT) { legend.classList.add('hidden'); return; }
    const cartesian = Cesium.Cartesian3.fromDegrees(legendAnchor.lon, legendAnchor.lat);
    const windowPos = Cesium.SceneTransforms.wgs84ToWindowCoordinates(viewer.scene, cartesian);
    if (!windowPos) { legend.classList.add('hidden'); return; }
    if (windowPos.x < 0 || windowPos.y < 0 || windowPos.x > window.innerWidth || windowPos.y > window.innerHeight) { legend.classList.add('hidden'); return; }
    legend.style.left = `${Math.round(windowPos.x) + 12}px`;
    legend.style.top = `${Math.round(windowPos.y) - 12}px`;
    legend.classList.remove('hidden');
  }
  function positionLegendAt(lon, lat) { legendAnchor.lon = lon; legendAnchor.lat = lat; updateLegend(); }
  viewer.scene.postRender.addEventListener(updateLegend);

  viewer.scene.globe.enableLighting = true;
  viewer.clock.shouldAnimate = true;

  const srcLink = document.getElementById('src');
  const dateLabel = document.getElementById('dateLabel');
  const alphaLabel = document.getElementById('alphaLabel');
  const wmsGetMap = `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=MODIS_Terra_NDVI_8Day&CRS=EPSG:4326&BBOX=-180,-90,180,90&WIDTH=1200&HEIGHT=600&FORMAT=image/png&TIME=${ndviDate}`;
  if (srcLink) srcLink.href = wmsGetMap;
  if (dateLabel) dateLabel.textContent = ndviDate;
  if (alphaLabel) alphaLabel.textContent = String(ndviWmsLayer.alpha);

  const srcBaseBmng = document.getElementById('srcBaseBmng');
  const bmngGetMap = `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=BlueMarble_NextGeneration&CRS=EPSG:4326&BBOX=-180,-90,180,90&WIDTH=1200&HEIGHT=600&FORMAT=image/png&TIME=${bmngDate}`;
  if (srcBaseBmng) srcBaseBmng.href = bmngGetMap;

  const srcLst = document.getElementById('srcLst');
  const lstGetMap = `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=MODIS_Terra_Land_Surface_Temp_Day&CRS=EPSG:4326&BBOX=-180,-90,180,90&WIDTH=1200&HEIGHT=600&FORMAT=image/png&TIME=${lstDate}`;
  if (srcLst) srcLst.href = lstGetMap;

  const srcGedi = document.getElementById('srcGedi');
  const gediGetMap = `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${gediLayerName}&CRS=EPSG:4326&BBOX=-180,-90,180,90&WIDTH=1200&HEIGHT=600&FORMAT=image/png&TIME=${gediDate}`;
  if (srcGedi) srcGedi.href = gediGetMap;

  const toggleNdvi = document.getElementById('toggleNdvi');
  const toggleLst = document.getElementById('toggleLst');
  const toggleGedi = document.getElementById('toggleGedi');
  const toggleCO = document.getElementById('toggleCO');
  const toggleMISR = document.getElementById('toggleMISR');
  const toggleLabels = document.getElementById('toggleLabels');
  const toggleSettlements = document.getElementById('toggleSettlements');
  const toggleCloudPressure = document.getElementById('toggleCloudPressure');
  const toggleCeresFlux = document.getElementById('toggleCeresFlux');
  const toggleMopitt = document.getElementById('toggleMopitt');

  toggleLabels?.addEventListener('change', (e) => { const checked = e.target?.checked ?? toggleLabels.checked; labelsLayer.show = checked; });
  toggleSettlements?.addEventListener('change', (e) => { const checked = e.target?.checked ?? toggleSettlements.checked; settlementsLayer.show = checked; checked ? showLayerNote('settlements') : hideLayerNote('settlements'); });
  toggleCloudPressure?.addEventListener('change', (e) => { const checked = e.target?.checked ?? toggleCloudPressure.checked; cloudPressureLayer.show = checked; checked ? showLayerNote('cloudPressure') : hideLayerNote('cloudPressure'); });
  toggleCeresFlux?.addEventListener('change', (e) => { const checked = e.target?.checked ?? toggleCeresFlux.checked; ceresFluxLayer.show = checked; checked ? showLayerNote('ceresFlux') : hideLayerNote('ceresFlux'); });
  toggleMopitt?.addEventListener('change', (e) => { const checked = e.target?.checked ?? toggleMopitt.checked; mopittLayer.show = checked; checked ? showLayerNote('mopitt') : hideLayerNote('mopitt'); });

  const timelineSlider = document.getElementById('timelineSlider');
  const timelineLabel = document.getElementById('timelineLabel');
  const playButton = document.getElementById('playTimeline');
  let isPlaying = false;
  let playInterval = null;
  function dayOfYearToDate(dayOfYear, year = 2024) { const date = new Date(year, 0, dayOfYear); return date.toISOString().split('T')[0]; }
  function updateTimeline() {
    const dayOfYear = parseInt(timelineSlider.value);
    const dateStr = dayOfYearToDate(dayOfYear);
    if (timelineLabel) timelineLabel.textContent = dateStr;
    updateLayersWithTime(dateStr);
  }
  function updateLayersWithTime(dateStr) {
    // Ensure we reference the actual layer variables
    if (typeof ndviWmsLayer !== 'undefined' && ndviWmsLayer && ndviWmsLayer.show) {
      ndviWmsLayer.imageryProvider.parameters.time = dateStr;
    }
    if (typeof lstWmsLayer !== 'undefined' && lstWmsLayer && lstWmsLayer.show) {
      lstWmsLayer.imageryProvider.parameters.time = dateStr;
    }
    if (typeof cloudPressureLayer !== 'undefined' && cloudPressureLayer && cloudPressureLayer.show) {
      cloudPressureLayer.imageryProvider.parameters.time = dateStr;
    }
    if (typeof mopittLayer !== 'undefined' && mopittLayer && mopittLayer.show) {
      mopittLayer.imageryProvider.parameters.time = dateStr + 'T20:07:58Z';
    }
  }
  timelineSlider?.addEventListener('input', updateTimeline);
  playButton?.addEventListener('click', () => {
    if (isPlaying) { clearInterval(playInterval); playButton.textContent = '▶ Play'; isPlaying = false; }
    else { playInterval = setInterval(() => { const currentValue = parseInt(timelineSlider.value); timelineSlider.value = (currentValue >= 365) ? 0 : currentValue + 1; updateTimeline(); }, 100); playButton.textContent = '⏸ Pause'; isPlaying = true; }
  });

  const layerNoteMeta = {
    ndvi: { title: 'NDVI (Vegetation Greenness)', desc: 'Normalized Difference Vegetation Index from MODIS Terra. Higher values indicate greener, denser vegetation.', cadence: '8‑day composite', units: 'unitless (−1 to 1)', source: 'NASA GIBS / MODIS Terra', link: 'https://wiki.earthdata.nasa.gov/display/GIBS' },
    lst: { title: 'Land Surface Temperature (Day)', desc: 'Estimated land skin temperature under daytime conditions from MODIS Terra.', cadence: 'daily', units: 'Kelvin (colorized)', source: 'NASA GIBS / MODIS Terra', link: 'https://wiki.earthdata.nasa.gov/display/GIBS' },
    gedi: { title: 'GEDI Aboveground Biomass Density (Mean)', desc: 'Spatially aggregated biomass density from GEDI lidar footprints (2019–2023 mean).', cadence: 'multi‑year mean', units: 'Mg/ha', source: 'NASA GIBS / GEDI L4B', link: 'https://gedi.umd.edu/' },
    co: { title: 'Carbon Monoxide @ 500 hPa (Day)', desc: 'AIRS L2 CO volume mixing ratio at ~500 hPa. Useful for pollution and fire plume tracking.', cadence: 'orbit granules', units: 'ppbv (colorized)', source: 'NASA GIBS / AIRS L2', link: 'https://airs.jpl.nasa.gov/' },
    misr: { title: 'MISR Infrared Color Radiance (Monthly Avg)', desc: 'MISR monthly average radiance composited in infrared color.', cadence: 'monthly', units: 'radiance (colorized)', source: 'NASA GIBS / MISR', link: 'https://misr.jpl.nasa.gov/' },
    imerg: { title: 'IMERG Precipitation Rate (30‑min)', desc: 'Near‑real‑time precipitation rate from GPM IMERG highlighting rain/snow intensity.', cadence: '30‑minute', units: 'mm/hr', source: 'NASA GIBS / GPM IMERG', link: 'https://gpm.nasa.gov/data/imerg' },
    settlements: { title: 'GRUMP Settlements', desc: 'Global Rural‑Urban Mapping Project settlement locations showing human population centers worldwide.', cadence: 'static', units: 'point locations', source: 'NASA GIBS / GRUMP', link: 'https://sedac.ciesin.columbia.edu/data/collection/grump-v1' },
    cloudPressure: { title: 'Cloud Top Pressure (Aqua)', desc: 'MODIS Aqua cloud top pressure measurements during daytime. Shows atmospheric pressure at cloud tops, useful for weather analysis and storm tracking.', cadence: 'daily', units: 'hPa (colorized)', source: 'NASA GIBS / MODIS Aqua', link: 'https://wiki.earthdata.nasa.gov/display/GIBS' },
    ceresFlux: { title: 'CERES Longwave Flux (Monthly)', desc: 'CERES EBAF TOA CRE Longwave Flux Monthly shows outgoing longwave radiation at the top of the atmosphere. Essential for understanding Earth\'s energy balance and climate.', cadence: 'monthly', units: 'W/m² (colorized)', source: 'NASA GIBS / CERES EBAF', link: 'https://ceres.larc.nasa.gov/data/' },
    mopitt: { title: 'MOPITT CO Total Column (Terra)', desc: 'MOPITT CO Monthly Total Column Day shows carbon monoxide concentrations in the atmosphere. Essential for air quality monitoring and pollution tracking.', cadence: 'monthly', units: 'molecules/cm² (colorized)', source: 'NASA GIBS / MOPITT Terra', link: 'https://www2.acom.ucar.edu/mopitt' }
  };
  function renderNoteElement(key, customText) {
    const meta = layerNoteMeta[key] || { title: key, desc: customText || key };
    const div = document.createElement('div');
    div.id = `note-${key}`;
    div.className = 'pointer-events-auto rounded-lg bg-zinc-900/80 border border-white/10 text-zinc-100 shadow-md backdrop-blur px-3 py-2 text-xs max-w-xs';
    div.innerHTML = `<div class="flex items-start gap-2">
        <span class="mt-1 w-2 h-2 rounded-full bg-emerald-400"></span>
        <div class="flex-1">
          <div class="font-medium text-[11px]">${meta.title}</div>
          <div class="text-zinc-300 mt-0.5">${customText || meta.desc}</div>
          <div class="mt-1 grid grid-cols-2 gap-2 text-[10px] text-zinc-400">
            ${meta.cadence ? `<div><span class=\"text-zinc-500\">Cadence:</span> ${meta.cadence}</div>` : ''}
            ${meta.units ? `<div><span class=\"text-zinc-500\">Units:</span> ${meta.units}</div>` : ''}
            ${meta.source ? `<div class=\"col-span-2\"><span class=\"text-zinc-500\">Source:</span> ${meta.source}</div>` : ''}
          </div>
          ${meta.link ? `<div class="mt-1"><a href="${meta.link}" target="_blank" rel="noopener noreferrer" class="text-emerald-300 hover:underline">Learn more</a></div>` : ''}
        </div>
        <button data-close="${key}" class="ml-2 text-zinc-400 hover:text-white">×</button>
      </div>`;
    div.querySelector('button[data-close]')?.addEventListener('click', () => hideLayerNote(key));
    return div;
  }
  function showLayerNote(key, customText) { const host = document.getElementById('layerNotes'); const existing = document.getElementById(`note-${key}`); if (existing) { existing.remove(); } host.appendChild(renderNoteElement(key, customText)); }
  function hideLayerNote(key) { const el = document.getElementById(`note-${key}`); if (el) el.classList.add('hidden'); }

  const toggleEonetWild = document.getElementById('toggleEonetWild');
  const toggleEonetFloods = document.getElementById('toggleEonetFloods');
  const toggleEonetDust = document.getElementById('toggleEonetDust');
  const toggleEonetStorms = document.getElementById('toggleEonetStorms');
  toggleNdvi?.addEventListener('change', (e) => { const checked = e.target?.checked ?? toggleNdvi.checked; ndviWmsLayer.show = checked; checked ? showLayerNote('ndvi') : hideLayerNote('ndvi'); });
  toggleLst?.addEventListener('change', (e) => { const checked = e.target?.checked ?? toggleLst.checked; lstWmsLayer.show = checked; checked ? showLayerNote('lst') : hideLayerNote('lst'); });
  toggleGedi?.addEventListener('change', (e) => { const checked = e.target?.checked ?? toggleGedi.checked; gediWmsLayer.show = checked; checked ? showLayerNote('gedi') : hideLayerNote('gedi'); });
  toggleCO?.addEventListener('change', (e) => { const checked = e.target?.checked ?? toggleCO.checked; coWmsLayer.show = checked; checked ? showLayerNote('co') : hideLayerNote('co'); });
  toggleMISR?.addEventListener('change', (e) => { const checked = e.target?.checked ?? toggleMISR.checked; misrWmsLayer.show = checked; checked ? showLayerNote('misr') : hideLayerNote('misr'); });

  function svgBillboard(fill) {
    return {
      image: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">\n' +
        `  <circle cx="12" cy="12" r="8" fill="${fill}" />` +
        '</svg>'
      ),
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      scale: 1.0
    };
  }
  function addEventEntityTo(ds, evt, polygonColor, pointBillboard) {
    const title = (evt && evt.title) ? evt.title : 'Event';
    const geoms = evt && evt.geometry ? evt.geometry : [];
    geoms.forEach(g => {
      const coords = g.coordinates; const dateStr = g.date || ''; if (!coords) return;
      if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        const lon = coords[0]; const lat = coords[1];
        ds.entities.add({ position: Cesium.Cartesian3.fromDegrees(lon, lat), billboard: pointBillboard, name: title, description: `${title}<br/>${dateStr}<br/>[${lon.toFixed(2)}, ${lat.toFixed(2)}]` });
      } else if (Array.isArray(coords)) {
        try { const ring = coords[0]; const flat = []; for (let i = 0; i < ring.length; i++) { const p = ring[i]; if (Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number') { flat.push(p[0], p[1]); } }
          if (flat.length >= 6) { ds.entities.add({ name: title, description: `${title}<br/>${dateStr}`, polygon: { hierarchy: Cesium.Cartesian3.fromDegreesArray(flat), material: polygonColor.withAlpha(0.35), outline: true, outlineColor: polygonColor.withAlpha(0.7) } }); }
        } catch(_) {}
      }
    });
  }

  const eonetCfgs = [
    { id: 'wildfires', url: 'https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&start=2020-01-01&end=2025-12-31', linkId: 'srcEonetWild', toggleId: 'toggleEonetWild', polygonColor: Cesium.Color.ORANGE, pointBillboard: svgBillboard('#ff7043') },
    { id: 'floods', url: 'https://eonet.gsfc.nasa.gov/api/v3/events?category=floods&start=2020-01-01&end=2025-12-31', linkId: 'srcEonetFloods', toggleId: 'toggleEonetFloods', polygonColor: Cesium.Color.CYAN, pointBillboard: svgBillboard('#00bcd4') },
    { id: 'dustHaze', url: 'https://eonet.gsfc.nasa.gov/api/v3/events?category=dustHaze&start=2020-01-01&end=2025-12-31', linkId: 'srcEonetDust', toggleId: 'toggleEonetDust', polygonColor: Cesium.Color.SANDYBROWN, pointBillboard: svgBillboard('#d2a679') },
    { id: 'severeStorms', url: 'https://eonet.gsfc.nasa.gov/api/v3/events?category=severeStorms&start=2020-01-01&end=2025-12-31', linkId: 'srcEonetStorms', toggleId: 'toggleEonetStorms', polygonColor: Cesium.Color.YELLOW, pointBillboard: svgBillboard('#ffeb3b') }
  ];

  const eonetDataSources = {};
  eonetCfgs.forEach(cfg => {
    const linkEl = document.getElementById(cfg.linkId); if (linkEl) linkEl.href = cfg.url;
    const ds = new Cesium.CustomDataSource('eonet-' + cfg.id); viewer.dataSources.add(ds); ds.show = false; eonetDataSources[cfg.id] = ds;
    fetch(cfg.url).then(r => r.json()).then(json => {
      const events = json && json.events ? json.events : [];
      events.forEach(evt => addEventEntityTo(ds, evt, cfg.polygonColor, cfg.pointBillboard));
      try { window.__allAnomalies = window.__allAnomalies || []; } catch(_) {}
      const pushSafe = (rec) => { try { window.__allAnomalies.push(rec); } catch(_) {} };
      events.forEach(evt => {
        const title = evt.title || 'Event'; const geoms = Array.isArray(evt.geometry) ? evt.geometry : [];
        geoms.forEach(g => {
          const when = g.date || ''; const coords = g.coordinates; let lat = null, lon = null;
          if (Array.isArray(coords) && typeof coords[0] === 'number' && typeof coords[1] === 'number') { lon = coords[0]; lat = coords[1]; }
          pushSafe({ category: cfg.id, title, date: when, lon, lat });
        });
      });
    }).catch(() => {});
    const toggleEl = document.getElementById(cfg.toggleId);
    toggleEl?.addEventListener('change', (e) => { const checked = e.target?.checked ?? toggleEl.checked; ds.show = checked; });
  });

  const anomalyBtn = document.getElementById('anomalyButton');
  const anomalyPanel = document.getElementById('anomalyPanel');
  const anomalyClose = document.getElementById('anomalyClose');
  const anomalyFrom = document.getElementById('anomalyFrom');
  const anomalyTo = document.getElementById('anomalyTo');
  const anomalyApply = document.getElementById('anomalyApply');
  const anomalyReset = document.getElementById('anomalyReset');
  const anomalyList = document.getElementById('anomalyList');
  const anomalySummary = document.getElementById('anomalySummary');
  const filterAll = document.getElementById('filterAll');
  const filterWildfires = document.getElementById('filterWildfires');
  const filterFloods = document.getElementById('filterFloods');
  const filterStorms = document.getElementById('filterStorms');
  const filterDust = document.getElementById('filterDust');
  let currentFilter = 'all';

  function toggleAnomalyPanel(forceOpen) {
    const willOpen = forceOpen === true ? true : (forceOpen === false ? false : anomalyPanel.classList.contains('hidden'));
    if (willOpen) anomalyPanel.classList.remove('hidden');
    else anomalyPanel.classList.add('hidden');
  }
  anomalyBtn?.addEventListener('click', () => toggleAnomalyPanel(true));
  anomalyClose?.addEventListener('click', () => toggleAnomalyPanel(false));

  function setActiveFilter(filter) {
    currentFilter = filter;
    [filterAll, filterWildfires, filterFloods, filterStorms, filterDust].forEach(btn => { btn?.classList.remove('active'); btn?.classList.add('opacity-60'); });
    const activeBtn = { 'all': filterAll, 'wildfires': filterWildfires, 'floods': filterFloods, 'storms': filterStorms, 'dust': filterDust }[filter];
    if (activeBtn) { activeBtn.classList.add('active'); activeBtn.classList.remove('opacity-60'); }
    renderAnomalies();
  }
  filterAll?.addEventListener('click', () => setActiveFilter('all'));
  filterWildfires?.addEventListener('click', () => setActiveFilter('wildfires'));
  filterFloods?.addEventListener('click', () => setActiveFilter('floods'));
  filterStorms?.addEventListener('click', () => setActiveFilter('storms'));
  filterDust?.addEventListener('click', () => setActiveFilter('dust'));

  const pageDashboard = document.getElementById('pageDashboard');
  const pageCommunity = document.getElementById('pageCommunity');
  let currentPage = 'dashboard';
  function setActivePage(page) {
    currentPage = page;
    [pageDashboard, pageCommunity].forEach(btn => { btn?.classList.remove('page-active'); btn?.classList.add('opacity-60'); });
    const activeBtn = { 'dashboard': pageDashboard, 'community': pageCommunity }[page];
    if (activeBtn) { activeBtn.classList.add('page-active'); activeBtn.classList.remove('opacity-60'); }
    handlePageChange(page);
  }
  function handlePageChange(page) {
    const cesiumEl = document.getElementById('cesiumContainer');
    const communityEl = document.getElementById('communitySection');
    if (!cesiumEl || !communityEl) { console.warn('Page containers missing'); return; }

    if (page === 'community') {
      cesiumEl.classList.add('hidden');
      communityEl.classList.remove('hidden');
    } else {
      communityEl.classList.add('hidden');
      cesiumEl.classList.remove('hidden');
    }
  }
  pageDashboard?.addEventListener('click', () => setActivePage('dashboard'));
  pageCommunity?.addEventListener('click', () => setActivePage('community'));

  // Community interactions
  function initCommunity() {
    const grid = document.getElementById('communityGrid');
    const searchInput = document.getElementById('communitySearch');
    const filterBtns = Array.from(document.querySelectorAll('.filter-btn'));
    if (!grid) return;

    // Join buttons
    grid.querySelectorAll('.join-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const joined = btn.classList.toggle('joined');
        btn.textContent = joined ? 'Joined' : 'Join';
      });
    });

    // Filtering by tag
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tag = btn.getAttribute('data-filter');
        const cards = Array.from(grid.querySelectorAll('.community-card'));
        cards.forEach(card => {
          const cardTags = (card.getAttribute('data-tags') || '').split(/\s+/);
          const show = tag === 'all' || cardTags.includes(tag);
          card.style.display = show ? '' : 'none';
        });
      });
    });

    // Search filter
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const q = searchInput.value.toLowerCase();
        const cards = Array.from(grid.querySelectorAll('.community-card'));
        cards.forEach(card => {
          const text = card.textContent.toLowerCase();
          card.style.display = text.includes(q) ? '' : 'none';
        });
      });
    }
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initCommunity());
  } else {
    initCommunity();
  }

  function parseDateSafe(s) { const d = new Date(s); return isNaN(d.getTime()) ? null : d; }
  function renderAnomalies() {
    const all = Array.isArray(window.__allAnomalies) ? window.__allAnomalies : [];
    const fromD = parseDateSafe(anomalyFrom.value);
    const toD = parseDateSafe(anomalyTo.value);
    const filtered = all.filter(rec => {
      const d = parseDateSafe(rec.date); if (!d) return false; if (fromD && d < fromD) return false; if (toD && d > toD) return false;
      if (currentFilter !== 'all') { const categoryMap = { 'wildfires': 'wildfires', 'floods': 'floods', 'storms': 'severeStorms', 'dust': 'dustHaze' }; if (rec.category !== categoryMap[currentFilter]) return false; }
      return true;
    }).sort((a,b) => new Date(b.date) - new Date(a.date));
    if (anomalySummary) anomalySummary.textContent = `${filtered.length} event(s)`;
    if (anomalyList) anomalyList.innerHTML = '';
    filtered.forEach(rec => {
      const row = document.createElement('div'); row.className = 'py-2 px-1 hover:bg-white/5';
      const catColor = { wildfires: 'bg-orange-500', floods: 'bg-cyan-500', dustHaze: 'bg-amber-600', severeStorms: 'bg-yellow-400' }[rec.category] || 'bg-zinc-500';
      row.innerHTML = `
        <div class="flex items-start gap-2">
          <span class="mt-1 w-2 h-2 rounded-full ${catColor}"></span>
          <div class="flex-1">
            <div class="text-sm font-medium">${rec.title}</div>
            <div class="text-xs text-zinc-400">${rec.category} • ${rec.date}</div>
            ${typeof rec.lat === 'number' && typeof rec.lon === 'number' ? `<div class="text-xs text-zinc-500">[${rec.lon.toFixed(2)}, ${rec.lat.toFixed(2)}]</div>` : ''}
          </div>
          <div class="flex flex-col items-end gap-1">
            ${typeof rec.lat === 'number' && typeof rec.lon === 'number' ? `<button class="text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600" data-goto="${rec.lon},${rec.lat}" data-category="${rec.category}" data-date="${rec.date}">Fly</button>` : ''}
            ${typeof rec.lat === 'number' && typeof rec.lon === 'number' ? `<button class="text-xs px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600" data-details="${rec.category}|${rec.date}|${rec.lon},${rec.lat}|${encodeURIComponent(rec.title)}">Details</button>` : ''}
          </div>
        </div>`;
      anomalyList?.appendChild(row);
    });
    anomalyList?.querySelectorAll('button[data-goto]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [lonStr, latStr] = btn.getAttribute('data-goto').split(','); const lon = parseFloat(lonStr), lat = parseFloat(latStr);
        if (!isNaN(lon) && !isNaN(lat)) { viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(lon, lat, 1500000) }); setTimeout(() => positionLegendAt(lon, lat), 400); }
        const category = btn.getAttribute('data-category'); const dateISO = btn.getAttribute('data-date'); if (category === 'severeStorms' && dateISO) { addOrUpdateIMERGLayer(dateISO); }
      });
    });
    anomalyList?.querySelectorAll('button[data-details]').forEach(btn => {
      btn.addEventListener('click', () => {
        const payload = btn.getAttribute('data-details'); if (!payload) return; const [category, dateStr, coordsStr, titleEnc] = payload.split('|');
        const [lonStr, latStr] = (coordsStr || '').split(','); const lon = parseFloat(lonStr), lat = parseFloat(latStr); const title = decodeURIComponent(titleEnc || 'Event'); if (isNaN(lon) || isNaN(lat)) return;
        const span = 12; const minLon = Math.max(-180, lon - span); const maxLon = Math.min(180, lon + span); const minLat = Math.max(-90, lat - span/2); const maxLat = Math.min(90, lat + span/2);
        const trueColor = 'VIIRS_NOAA21_CorrectedReflectance_TrueColor'; const precip = 'IMERG_Precipitation_Rate_30min'; const labels = 'Reference_Labels_15m'; const features = 'Reference_Features_15m'; const coast = 'Coastlines_15m(hidden)';
        const showPrecip = (category === 'severeStorms' || category === 'floods'); const layers = [labels, features, coast, trueColor].concat(showPrecip ? [precip] : []);
        const t = (new Date(dateStr)).toISOString().slice(0,10) + '-T00%3A00%3A00Z'; const v = `${minLon},${minLat},${maxLon},${maxLat}`;
        const worldviewUrl = `https://worldview.earthdata.nasa.gov/?v=${encodeURIComponent(v)}&z=4&ics=true&ici=5&icd=30&l=${encodeURIComponent(layers.join(','))}&lg=false&t=${t}`;
        window.open(worldviewUrl, '_blank', 'noopener,noreferrer');
      });
    });
  }

  anomalyApply?.addEventListener('click', renderAnomalies);
  anomalyReset?.addEventListener('click', () => { if (anomalyFrom) anomalyFrom.value = ''; if (anomalyTo) anomalyTo.value = ''; renderAnomalies(); });
  const now = new Date(); const past = new Date(now.getTime() - 90*24*60*60*1000);
  if (anomalyTo) anomalyTo.value = now.toISOString().slice(0,10);
  if (anomalyFrom) anomalyFrom.value = past.toISOString().slice(0,10);
  setTimeout(renderAnomalies, 1500);

  const wvBackdrop = document.getElementById('wvBackdrop');
  const wvClose = document.getElementById('wvClose');
  wvBackdrop?.addEventListener('click', () => document.getElementById('wvModal').classList.add('hidden'));
  wvClose?.addEventListener('click', () => document.getElementById('wvModal').classList.add('hidden'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.getElementById('wvModal').classList.add('hidden'); });

  viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(90, 20, 20000000) });
  Promise.allSettled([ndviWmsProvider.readyPromise, lstWmsProvider.readyPromise, gediWmsProvider.readyPromise]).then(() => { if (statusEl) statusEl.textContent = 'ready'; }).catch(() => { if (statusEl) statusEl.textContent = 'loaded with warnings'; });

  // --- Context publishing for AI page ---
  function getEarthContext(){
    const layers = {
      NDVI: !!(typeof ndviWmsLayer !== 'undefined' && ndviWmsLayer && ndviWmsLayer.show),
      LST: !!(typeof lstWmsLayer !== 'undefined' && lstWmsLayer && lstWmsLayer.show),
      GEDI: !!(typeof gediWmsLayer !== 'undefined' && gediWmsLayer && gediWmsLayer.show),
      MOPITT: !!(typeof mopittLayer !== 'undefined' && mopittLayer && mopittLayer.show),
      CO: !!(typeof coWmsLayer !== 'undefined' && coWmsLayer && coWmsLayer.show),
      MISR: !!(typeof misrWmsLayer !== 'undefined' && misrWmsLayer && misrWmsLayer.show),
      Labels: !!(typeof labelsLayer !== 'undefined' && labelsLayer && labelsLayer.show),
      Settlements: !!(typeof settlementsLayer !== 'undefined' && settlementsLayer && settlementsLayer.show),
      CloudPressure: !!(typeof cloudPressureLayer !== 'undefined' && cloudPressureLayer && cloudPressureLayer.show),
      CeresFlux: !!(typeof ceresFluxLayer !== 'undefined' && ceresFluxLayer && ceresFluxLayer.show)
    };
    let camera = null;
    try {
      const c = viewer.camera.positionCartographic; if (c) { camera = { lon: Cesium.Math.toDegrees(c.longitude), lat: Cesium.Math.toDegrees(c.latitude), height: c.height }; }
    } catch(_) {}
    const ctx = {
      page: 'earth',
      timestamp: new Date().toISOString(),
      anomaliesFilter: (typeof currentFilter !== 'undefined') ? currentFilter : 'all',
      anomalyRange: { from: anomalyFrom?.value || '', to: anomalyTo?.value || '' },
      timelineDate: (typeof timelineLabel !== 'undefined' && timelineLabel) ? timelineLabel.textContent : null,
      layers,
      camera
    };
    return ctx;
  }
  function saveEarthContext(){ try { localStorage.setItem('earthContext', JSON.stringify(getEarthContext())); } catch(_){} }

  // Publish trimmed anomalies summary for AI page
  function readAllAnomalies(){
    try { return Array.isArray(window.__allAnomalies) ? window.__allAnomalies : []; } catch(_) { return []; }
  }
  function buildAnomalySummary(all){
    const byCat = { wildfires: [], floods: [], dustHaze: [], severeStorms: [] };
    all.forEach(rec => { if (rec && rec.category && byCat[rec.category]) byCat[rec.category].push(rec); });
    const parseDate = (s) => { const d = new Date(s); return isNaN(d.getTime()) ? 0 : d.getTime(); };
    Object.keys(byCat).forEach(k => byCat[k].sort((a,b) => parseDate(b.date) - parseDate(a.date)));
    const latestByCategory = {};
    Object.keys(byCat).forEach(k => { if (byCat[k][0]) latestByCategory[k] = byCat[k][0]; });
    // Keep top 100 most recent across all categories
    const topRecent = all.slice().sort((a,b) => parseDate(b.date) - parseDate(a.date)).slice(0, 100);
    return {
      lastUpdated: new Date().toISOString(),
      counts: Object.fromEntries(Object.keys(byCat).map(k => [k, byCat[k].length])),
      latestByCategory,
      topRecent
    };
  }
  function saveEarthAnomalies(){
    const all = readAllAnomalies();
    if (!all.length) return;
    const summary = buildAnomalySummary(all);
    try { localStorage.setItem('earthAnomalies', JSON.stringify(summary)); } catch(_){}
  }

  // Save on toggle changes
  [toggleNdvi, toggleLst, toggleGedi, toggleCO, toggleMISR, toggleLabels, toggleSettlements, toggleCloudPressure, toggleCeresFlux, toggleMopitt]
    .filter(Boolean)
    .forEach(el => el.addEventListener('change', saveEarthContext));
  // Save on anomaly filter or date changes
  [filterAll, filterWildfires, filterFloods, filterStorms, filterDust, anomalyFrom, anomalyTo]
    .filter(Boolean)
    .forEach(el => el.addEventListener('click', saveEarthContext));
  anomalyFrom?.addEventListener('change', saveEarthContext);
  anomalyTo?.addEventListener('change', saveEarthContext);
  // Save on timeline change
  timelineSlider?.addEventListener('input', saveEarthContext);
  // Periodic background save
  setInterval(saveEarthContext, 5000);
  setInterval(saveEarthAnomalies, 5000);
  // Initial save attempts
  saveEarthContext();
  saveEarthAnomalies();

  // Enhance AI link to include context
  const dockAI = document.getElementById('dockAI');
  dockAI?.addEventListener('click', (e) => {
    e.preventDefault();
    saveEarthContext();
    saveEarthAnomalies();
    const raw = localStorage.getItem('earthContext');
    const href = '/public/AI.html' + (raw ? ('?ctx=' + encodeURIComponent(btoa(raw))) : '');
    window.location.href = href;
  });
})();


