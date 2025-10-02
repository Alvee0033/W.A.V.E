(function(){
  // Mapbox access token (you'll need to replace this with your own)
  mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';

  // Initialize the map
  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/satellite-v9',
    center: [0, 20],
    zoom: 2,
    maxZoom: 10,
    minZoom: 1
  });

  // DOM elements
  const status = document.getElementById('status');
  const buildBtn = document.getElementById('buildBtn');
  const playBtn = document.getElementById('playBtn');
  const currentDateEl = document.getElementById('currentDate');
  const zoomInBtn = document.getElementById('zoomIn');
  const zoomOutBtn = document.getElementById('zoomOut');
  const datePicker = document.getElementById('datePicker');
  const avhrrToggle = document.getElementById('avhrrToggle');
  const modisToggle = document.getElementById('modisToggle');
  const fromDate = document.getElementById('fromDate');
  const toDate = document.getElementById('toDate');
  
  // Menu elements
  const menuBtn = document.getElementById('menuButton');
  const menuPanel = document.getElementById('menuPanel');

  // State management
  let isBuilding = false;
  let isPlaying = false;
  let builtImages = [];
  let currentFrameIndex = 0;
  let playInterval = null;

  // Date range: September 9-30, 2024
  const startDate = new Date('2024-09-09');
  const endDate = new Date('2024-09-30');
  
  function generateDateRange() {
    const dates = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  const dateRange = generateDateRange();

  // Optional: initialize date from URL (Worldview-style `t=YYYY-MM-DDTHH:MM:SSZ`)
  function getInitialDateFromURL() {
    try {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('t');
      if (!t) return null;
      const day = t.split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        const d = new Date(`${day}T00:00:00Z`);
        return isNaN(d.getTime()) ? null : d;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  // NASA GIBS tile-based layer configurations - Dynamic tiles like NASA Worldview
  const layerConfigs = {
    bluemarble: {
      id: 'bluemarble-base',
      tileUrl: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/{time}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg',
      isBase: true,
      hasTime: true,
      maxZoom: 8,
      minZoom: 0
    },
    avhrr_sst: {
      id: 'avhrr-sst-layer',
      tileUrl: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/AVHRR_MetOp-B_L3U_Sea_Surface_Temperature/default/{time}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png',
      isBase: false,
      hasTime: true,
      maxZoom: 7,
      minZoom: 0,
      opacity: 0.8
    },
    modis_sst_day: {
      id: 'modis-sst-day-layer',
      tileUrl: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_L2_Sea_Surface_Temp_Day/default/{time}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png',
      isBase: false,
      hasTime: true,
      maxZoom: 7,
      minZoom: 0,
      opacity: 0.8
    }
  };

  // Format date for NASA GIBS API
  function formatDateForAPI(date) {
    return date.toISOString().split('T')[0];
  }

  // Format date for display
  function formatDateForDisplay(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }

  // Add or update a layer - Using NASA GIBS tile service for dynamic loading
  function addOrUpdateLayer(layerKey, date) {
    const config = layerConfigs[layerKey];
    const dateStr = formatDateForAPI(date);
    const layerId = config.id;

    // Remove existing layer if it exists
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    if (map.getSource(layerId)) {
      map.removeSource(layerId);
    }

    // Create NASA GIBS tile URL with proper time parameter
    let tileUrl = config.tileUrl;
    
    // Replace time placeholder for layers that support it
    if (config.hasTime) {
      tileUrl = tileUrl.replace('{time}', dateStr);
    }

    // Add source with dynamic tile loading
    map.addSource(layerId, {
      type: 'raster',
      tiles: [tileUrl],
      tileSize: 256,
      maxzoom: config.maxZoom,
      minzoom: config.minZoom
    });

    // Add layer with proper ordering (base layers first)
    const layerConfig = {
      id: layerId,
      type: 'raster',
      source: layerId,
      paint: {
        'raster-opacity': config.opacity || (config.isBase ? 1.0 : 0.7)
      }
    };

    // Insert base layers at the bottom, overlays on top
    if (config.isBase) {
      map.addLayer(layerConfig);
    } else {
      // Add overlay layers above base layers
      const existingLayers = map.getStyle().layers;
      const firstOverlayIndex = existingLayers.findIndex(layer => 
        layer.id.includes('overlay')
      );
      
      if (firstOverlayIndex !== -1) {
        map.addLayer(layerConfig, existingLayers[firstOverlayIndex].id);
      } else {
        map.addLayer(layerConfig);
      }
    }
  }

  // Remove a layer
  function removeLayer(layerKey) {
    const config = layerConfigs[layerKey];
    const layerId = config.id;

    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    if (map.getSource(layerId)) {
      map.removeSource(layerId);
    }
  }

  // Get current selected date
  function getCurrentDate() {
    if (datePicker && datePicker.value) {
      return new Date(datePicker.value);
    }
    return new Date(); // fallback to today
  }

  // Update layers based on current date and layer toggles
  function updateLayers(date) {
    const selectedDate = date || getCurrentDate();
    
    // Always show Blue Marble base
    addOrUpdateLayer('bluemarble', selectedDate);

    // Show/hide AVHRR SST layer based on toggle
    if (avhrrToggle && avhrrToggle.checked) {
      addOrUpdateLayer('avhrr_sst', selectedDate);
    } else {
      removeLayer('avhrr_sst');
    }

    // Show/hide MODIS Terra L2 SST (Day) layer based on toggle
    if (modisToggle && modisToggle.checked) {
      addOrUpdateLayer('modis_sst_day', selectedDate);
    } else {
      removeLayer('modis_sst_day');
    }

    // Update current date display
    if (selectedDate) {
      document.getElementById('currentDate').textContent = `${formatDateForDisplay(selectedDate)}`;
    }
  }

  // Simulate building process (fetching images)
  async function buildImages() {
    if (isBuilding) return;
    
    isBuilding = true;
    buildBtn.disabled = true;
    buildBtn.textContent = 'Building...';
    playBtn.disabled = true;
    
    builtImages = [];
    
    for (let i = 0; i < dateRange.length; i++) {
      const date = dateRange[i];
      const progress = Math.round(((i + 1) / dateRange.length) * 100);
      
      status.textContent = `Building... ${progress}% (${formatDateForDisplay(date)})`;
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Store the date for this frame
      builtImages.push(date);
    }
    
    isBuilding = false;
    buildBtn.disabled = false;
    buildBtn.textContent = 'Build';
    playBtn.disabled = false;
    status.textContent = `Built ${builtImages.length} frames`;
    
    // Show first frame
    if (builtImages.length > 0) {
      currentFrameIndex = 0;
      updateLayers(builtImages[currentFrameIndex]);
    }
  }

  // Play/pause functionality
  function togglePlayback() {
    if (builtImages.length === 0) {
      status.textContent = 'Please build first';
      return;
    }

    if (isPlaying) {
      // Pause
      clearInterval(playInterval);
      isPlaying = false;
      playBtn.textContent = 'Play';
      status.textContent = 'Paused';
    } else {
      // Play
      isPlaying = true;
      playBtn.textContent = 'Pause';
      
      playInterval = setInterval(() => {
        currentFrameIndex = (currentFrameIndex + 1) % builtImages.length;
        const frameDate = builtImages[currentFrameIndex];
        updateLayers(frameDate);
        
        status.textContent = `Playing... Frame ${currentFrameIndex + 1}/${builtImages.length}`;
      }, 500); // 500ms between frames
    }
  }

  // Event listeners
  map.on('load', () => {
    // Initialize with date from URL if provided (e.g., Worldview link), otherwise current
    const urlDate = getInitialDateFromURL();
    if (urlDate && datePicker) {
      datePicker.value = formatDateForAPI(urlDate);
      updateLayers(urlDate);
    } else {
      updateLayers();
    }
    status.textContent = 'Ready';
  });

  // Zoom event listener for dynamic layer refresh
  map.on('zoomend', () => {
    // Refresh all active layers when zoom changes to ensure proper tile loading
    updateLayers(getCurrentDate());
  });

  // Move event listener for dynamic layer refresh during panning
  map.on('moveend', () => {
    // Refresh all active layers when viewport changes
    updateLayers(getCurrentDate());
  });

  // Date picker change listener
  if (datePicker) {
    datePicker.addEventListener('change', () => {
      updateLayers();
    });
  }

  // Build button
  buildBtn.addEventListener('click', buildImages);

  // Play button
  playBtn.addEventListener('click', togglePlayback);

  // MODIS SST Day layer toggle
  if (modisToggle) {
    modisToggle.addEventListener('change', () => {
      updateLayers();
    });
  }

  // AVHRR SST layer toggle
  if (avhrrToggle) {
    avhrrToggle.addEventListener('change', () => {
      updateLayers();
    });
  }

  // Zoom controls
  zoomInBtn.addEventListener('click', () => {
    map.zoomIn();
  });

  zoomOutBtn.addEventListener('click', () => {
    map.zoomOut();
  });

  // --- Menu functionality ---
  // Close menu when clicking outside
  document.addEventListener('click', (event) => {
    if (!menuPanel.contains(event.target) && !menuBtn.contains(event.target)) {
      menuPanel.classList.add('hidden');
    }
  });

  // Toggle menu panel
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menuPanel.classList.toggle('hidden');
    if (!menuPanel.classList.contains('hidden')) {
      // Focus the menu panel for better accessibility
      menuPanel.focus();
    }
  });

  // Update current date display
  function updateCurrentDateDisplay() {
    if (currentDateEl && datePicker) {
      const selectedDate = new Date(datePicker.value);
      const options = { month: 'short', day: 'numeric', year: 'numeric' };
      currentDateEl.textContent = selectedDate.toLocaleDateString('en-US', options);
    }
  }

  // Initial date display update
  updateCurrentDateDisplay();

  // Update date display when date picker changes
  datePicker.addEventListener('change', () => {
    updateCurrentDateDisplay();
  });

  // Compact date range: sync hidden datePicker with 'to' date for display
  toDate?.addEventListener('change', (e) => {
    if (datePicker) {
      datePicker.value = e.target.value;
      updateCurrentDateDisplay();
    }
  });

  // Optional: if 'from' changes and 'to' is empty, mirror to current date for display
  fromDate?.addEventListener('change', (e) => {
    if (datePicker && !toDate?.value) {
      datePicker.value = e.target.value;
      updateCurrentDateDisplay();
    }
  });

})();


