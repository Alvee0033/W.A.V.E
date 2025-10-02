// Sea Surface Temperature Timelapse - Clean Implementation
(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    mapboxToken: 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw', // Mapbox demo token
    defaultDateRange: {
      start: '2024-09-09',
      end: '2024-09-30'
    },
    frameRate: 1000, // 1 frame per second
    thumbnailSize: { width: 120, height: 80 }
  };

  // NASA GIBS Layer Configurations
  const LAYERS = {
    bluemarble: {
      id: 'bluemarble-base',
      name: 'Blue Marble Shaded Relief',
      tileUrl: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/2025-10-02/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',
      isBase: true,
      hasTime: false,  // Blue Marble is static, no time parameter needed
      maxZoom: 8,
      minZoom: 0,
      opacity: 1.0
    },
    sst: {
      id: 'sst-layer',
      name: 'Sea Surface Temperature',
      tileUrl: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GHRSST_L4_MUR_Sea_Surface_Temperature/default/{time}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png',
      isBase: false,
      hasTime: true,
      maxZoom: 7,
      minZoom: 0,
      opacity: 0.8
    }
  };

  // State Management
  const state = {
    map: null,
    isBuilding: false,
    isPlaying: false,
    builtImages: [],
    builtFrameUrls: [],
    currentFrameIndex: 0,
    playInterval: null,
    builtVideoUrl: null,
    builtVideoBlob: null,
    layerState: {
      bluemarble: { visible: true, activeSuffix: 'A', lastDateStr: null },
      sst: { visible: false, activeSuffix: 'A', lastDateStr: null }
    }
  };

  // DOM Elements
  const elements = {
    map: null,
    status: null,
    buildBtn: null,
    playBtn: null,
    downloadBtn: null,
    fromDate: null,
    toDate: null,
    datePicker: null,
    avhrrToggle: null,
    modisToggle: null,
    frameOverlay: null,
    frameImage: null,
    loadingIndicator: null,
    loadingText: null,
    frameCount: null,
    layersButton: null,
    layersDropdown: null
  };

  // Utility Functions
  function formatDateForAPI(date) {
    return date.toISOString().split('T')[0];
  }

  function formatDateForDisplay(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }

  function generateDateRange(start, end) {
    const dates = [];
    const current = new Date(start);
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  function updateStatus(message) {
    if (elements.status) {
      elements.status.textContent = message;
    }
  }

  function showLoading(message = 'Loading...') {
    if (elements.loadingIndicator) {
      elements.loadingIndicator.style.display = 'block';
      if (elements.loadingText) {
        elements.loadingText.textContent = message;
      }
    }
  }

  function hideLoading() {
    if (elements.loadingIndicator) {
      elements.loadingIndicator.style.display = 'none';
    }
  }

  // Map Initialization
  function initMap() {
    try {
      mapboxgl.accessToken = CONFIG.mapboxToken;
      
      // Use a minimal custom style to avoid Mapbox style API (403) and rely on raster sources we add dynamically
      console.log('Initializing Mapbox map...');
      state.map = new mapboxgl.Map({
        container: elements.map,
        style: { version: 8, sources: {}, layers: [] },
        center: [0, 20],
        zoom: 2,
        maxZoom: 10,
        minZoom: 1
      });

      // Wait for map to be fully loaded before any operations
      state.map.on('load', () => {
        updateStatus('Map loaded');
        console.log('Mapbox map loaded.');
        
        // Load base layer after map is ready
        try {
          updateLayers();
        } catch (error) {
          console.error('Error updating layers on initial load:', error);
        }
      });

      state.map.on('error', (e) => {
        console.error('A Mapbox error occurred:', e);
        updateStatus('Map error occurred');
      });

    } catch (error) {
      console.error('Failed to initialize map:', error);
      updateStatus('Failed to load map');
    }
  }

  // Layer Management
  function ensureLayerForDate(layerKey, date) {
    console.log('ensureLayerForDate called for layer:', layerKey, 'date:', date);
    const config = LAYERS[layerKey];
    const dateStr = formatDateForAPI(date);
    const layerState = state.layerState[layerKey] || { activeSuffix: 'A', lastDateStr: null };
    const currentSuffix = layerState.activeSuffix;
    const nextSuffix = currentSuffix === 'A' ? 'B' : 'A';
    const currentId = `${config.id}-${currentSuffix}`;
    const nextId = `${config.id}-${nextSuffix}`;

    // Safety checks
    if (!state.map || !state.map.isStyleLoaded()) {
      console.log('Map not ready for layer:', layerKey);
      return Promise.resolve();
    }

    // If already showing this date (or for static layers, if already loaded), do nothing
    if (!config.hasTime && state.map.getLayer(currentId)) {
      console.log('Static layer already loaded:', layerKey);
      return Promise.resolve();
    }
    if (layerState.lastDateStr === dateStr && state.map.getLayer(currentId)) {
      console.log('Layer already showing for date:', layerKey, dateStr);
      return Promise.resolve();
    }

    // Build tile URL for the target date
    let tileUrl = config.tileUrl;
    if (config.hasTime) tileUrl = tileUrl.replace('{time}', dateStr);
    console.log('Generated tile URL for', layerKey, ':', tileUrl);

    // Remove any stale next layer/source before adding fresh
    if (state.map.getLayer(nextId)) state.map.removeLayer(nextId);
    if (state.map.getSource(nextId)) state.map.removeSource(nextId);

    state.map.addSource(nextId, {
      type: 'raster',
      tiles: [tileUrl],
      tileSize: 256,
      maxzoom: config.maxZoom,
      minzoom: config.minZoom
    });

    const layerConfig = {
      id: nextId,
      type: 'raster',
      source: nextId,
      paint: {
        'raster-opacity': 0
      }
    };

    // Ensure base sits at bottom; overlays can be on top
    // Safety checks for map operations
    if (!state.map || !state.map.isStyleLoaded()) {
      return;
    }

    const existingLayers = state.map.getStyle().layers || [];
    if (config.isBase && existingLayers.length > 0) {
      state.map.addLayer(layerConfig, existingLayers[0].id);
    } else {
      state.map.addLayer(layerConfig);
    }
    
    // Prepare transition for smooth crossfade
    state.map.setPaintProperty(nextId, 'raster-opacity-transition', { duration: 300 });
    if (state.map.getLayer(currentId)) {
      state.map.setPaintProperty(currentId, 'raster-opacity-transition', { duration: 300 });
    }

    return new Promise((resolve) => {
      function onSourceData(e) {
        if (e.sourceId === nextId && state.map.isSourceLoaded(nextId)) {
          state.map.off('sourcedata', onSourceData);
          // Fade in new layer
          state.map.setPaintProperty(nextId, 'raster-opacity', config.opacity || (config.isBase ? 1.0 : 0.8));
          // Fade out and remove previous layer once faded
          if (state.map.getLayer(currentId)) {
            state.map.setPaintProperty(currentId, 'raster-opacity', 0);
            setTimeout(() => {
              if (state.map.getLayer(currentId)) state.map.removeLayer(currentId);
              if (state.map.getSource(currentId)) state.map.removeSource(currentId);
            }, 320);
          }
          state.layerState[layerKey] = { activeSuffix: nextSuffix, lastDateStr: dateStr };
          resolve();
        }
      }
      state.map.on('sourcedata', onSourceData);
    });
  }

  function removeLayerPair(layerKey) {
    const config = LAYERS[layerKey];
    ['A','B'].forEach(suffix => {
      const id = `${config.id}-${suffix}`;
      if (state.map.getLayer(id)) state.map.removeLayer(id);
      if (state.map.getSource(id)) state.map.removeSource(id);
    });
    if (state.layerState[layerKey]) {
      state.layerState[layerKey].lastDateStr = null;
    }
  }

  function updateLayers(date) {
    console.log('updateLayers called with date:', date);
    if (!state.map || !state.map.isStyleLoaded()) return;

    const selectedDate = date || getCurrentDate();

    // Always show Blue Marble base
    ensureLayerForDate('bluemarble', selectedDate);

    // Toggle SST overlay
    if (state.layerState.sst && state.layerState.sst.visible) {
      ensureLayerForDate('sst', selectedDate);
    } else {
      removeLayerPair('sst');
    }
  }

  function getCurrentDate() {
    if (elements.datePicker && elements.datePicker.value) {
      return new Date(elements.datePicker.value);
    }
    return new Date();
  }

  // Frame Fetching and Processing
  async function fetchStaticFrame(date) {
    try {
      const bounds = state.map.getBounds();
      const zoom = Math.floor(state.map.getZoom());
      const size = state.map.getContainer();
      const width = size.offsetWidth;
      const height = size.offsetHeight;
      
      const dateStr = formatDateForAPI(date);
      
      // Build WMS request for NASA GIBS
      const baseUrl = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
      const params = new URLSearchParams({
        SERVICE: 'WMS',
        VERSION: '1.3.0',
        REQUEST: 'GetMap',
        FORMAT: 'image/png',
        TRANSPARENT: 'true',
        LAYERS: getActiveLayersString(dateStr),
        CRS: 'EPSG:4326',
        STYLES: '',
        WIDTH: width.toString(),
        HEIGHT: height.toString(),
        BBOX: `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`,
        TIME: dateStr
      });
      
      const imageUrl = `${baseUrl}?${params.toString()}`;
      
      // Convert to data URL for caching
      return await imageToDataUrl(imageUrl);
    } catch (error) {
      console.warn('Failed to fetch static frame:', error);
      return null;
    }
  }

  function getActiveLayersString(dateStr) {
    const layers = ['BlueMarble_NextGeneration'];

    // Include SST overlay if toggled
    if (elements.sstLayer && elements.sstLayer.checked) {
      layers.push('GHRSST_L4_MUR_Sea_Surface_Temperature');
    }

    // Optional legacy toggles
    if (elements.avhrrToggle && elements.avhrrToggle.checked) {
      layers.push('AVHRR_MetOp-B_L3U_Sea_Surface_Temperature');
    }
    if (elements.modisToggle && elements.modisToggle.checked) {
      layers.push('MODIS_Terra_L2_Sea_Surface_Temp_Day');
    }
    return layers.join(',');
  }

  async function imageToDataUrl(imageUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      
      img.onerror = function() {
        reject(new Error('Failed to load image'));
      };
      
      img.src = imageUrl;
    });
  }

  // Thumbnail Management - REMOVED (animation frames section removed)
  function renderThumbnails() {
    // Function removed - no longer needed
    return;
  }

  function createThumbnail(url, date, index) {
    // Function removed - no longer needed
    return null;
  }

  async function buildFrames() {
     if (state.isBuilding) return;
     
     state.isBuilding = true;
     elements.buildBtn.disabled = true;
     elements.buildBtn.textContent = 'Building...';
     showLoading();
     
     // Clear previous data
     state.builtImages = [];
     state.builtFrameUrls = [];
     state.builtVideoUrl = null;
     state.builtVideoBlob = null;
     
     updateFrameCount();
     
     // Get date range
     const startDate = new Date(elements.fromDate.value);
     const endDate = new Date(elements.toDate.value);
     const dates = generateDateRange(startDate, endDate);
     
     updateStatus(`Fetching ${dates.length} frames...`);
     
     // Fetch all frames sequentially
     for (let i = 0; i < dates.length; i++) {
       const date = dates[i];
       const progress = Math.round(((i + 1) / dates.length) * 100);
       
       updateStatus(`Fetching frame ${i + 1} of ${dates.length} (${progress}%)`);
       
       try {
         const frameUrl = await fetchStaticFrame(date);
         if (frameUrl) {
           state.builtFrameUrls.push(frameUrl);
           state.builtImages.push(date);
           updateFrameCount();
         }
       } catch (error) {
         console.warn(`Failed to fetch frame for ${formatDateForDisplay(date)}:`, error);
       }
     }
     
     hideLoading();
     
     if (state.builtFrameUrls.length > 0) {
       updateStatus(`Built ${state.builtFrameUrls.length} frames successfully`);
     } else {
       updateStatus('No frames were built. Please check your date range and try again.');
     }
     
     state.isBuilding = false;
     elements.buildBtn.disabled = false;
     elements.buildBtn.textContent = 'Build Frames';
   }

  function updateFrameCount() {
    if (elements.frameCount) {
      elements.frameCount.textContent = `${state.builtFrameUrls.length} frames`;
    }
  }

  function jumpToFrame(index) {
    if (index < 0 || index >= state.builtFrameUrls.length) return;
    
    // Stop playback if running
    if (state.isPlaying) {
      stopPlayback();
    }
    
    state.currentFrameIndex = index;
    showFrame(index);
    
    // Update thumbnail highlighting
    updateThumbnailHighlight();
  }

  function updateThumbnailHighlight() {
    const thumbnails = document.querySelectorAll('[data-index]');
    thumbnails.forEach((thumb, index) => {
      if (index === state.currentFrameIndex) {
        thumb.style.borderColor = '#10b981';
        thumb.style.boxShadow = '0 0 0 2px #10b981, 0 0 20px rgba(16, 185, 129, 0.3)';
      } else {
        thumb.style.borderColor = 'transparent';
        thumb.style.boxShadow = '';
      }
    });
  }

  // Playback Functions
  function showFrame(index) {
    if (!elements.frameOverlay || !elements.frameImage) return;
    
    if (index >= 0 && index < state.builtFrameUrls.length) {
      elements.frameImage.src = state.builtFrameUrls[index];
      elements.frameOverlay.style.opacity = '1';
      elements.frameOverlay.style.pointerEvents = 'auto';
      updateStatus(`Frame ${index + 1} of ${state.builtFrameUrls.length}`);
    }
  }

  function hideFrame() {
    if (!elements.frameOverlay) return;
    elements.frameOverlay.style.opacity = '0';
    elements.frameOverlay.style.pointerEvents = 'none';
  }

  function startPlayback() {
    if (state.builtFrameUrls.length === 0) {
      updateStatus('No frames to play. Please build first.');
      return;
    }
    
    state.isPlaying = true;
    state.currentFrameIndex = 0;
    
    if (elements.playBtn) {
      elements.playBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
        Pause
      `;
    }
    
    advanceFrame();
  }

  function stopPlayback() {
    state.isPlaying = false;
    
    if (state.playInterval) {
      clearTimeout(state.playInterval);
      state.playInterval = null;
    }
    
    if (elements.playBtn) {
      elements.playBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
        Play
      `;
    }
    
    hideFrame();
    updateThumbnailHighlight();
  }

  function advanceFrame() {
    if (!state.isPlaying || state.builtFrameUrls.length === 0) return;
    
    showFrame(state.currentFrameIndex);
    updateThumbnailHighlight();
    
    // Schedule next frame
    state.playInterval = setTimeout(() => {
      if (!state.isPlaying) return;
      state.currentFrameIndex = (state.currentFrameIndex + 1) % state.builtFrameUrls.length;
      advanceFrame();
    }, CONFIG.frameRate);
  }

  // Build Process
   async function buildFrames() {
    if (state.isBuilding) return;
    
    state.isBuilding = true;
    
    if (elements.buildBtn) {
      elements.buildBtn.disabled = true;
      elements.buildBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="animation: spin 1s linear infinite;">
          <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
        </svg>
        Building...
      `;
    }
    
    if (elements.playBtn) elements.playBtn.disabled = true;
    if (elements.downloadBtn) elements.downloadBtn.disabled = true;
    
    showLoading('Fetching frames...');
    
    // Clear previous data
    state.builtImages = [];
    state.builtFrameUrls = [];
    state.builtVideoUrl = null;
    state.builtVideoBlob = null;
    
    // Clear thumbnails immediately and show placeholder
        if (elements.thumbnailsScroll) {
          elements.thumbnailsScroll.innerHTML = `
            <div class="flex-shrink-0 w-32 h-20 glass rounded-lg flex items-center justify-center text-gray-500">
              <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
              </svg>
            </div>
          `;
        }
    updateFrameCount();
    
    // Get date range
    const startDate = new Date(elements.fromDate.value);
    const endDate = new Date(elements.toDate.value);
    const dates = generateDateRange(startDate, endDate);
    
    updateStatus(`Fetching ${dates.length} frames...`);
    
    // Fetch all frames sequentially and show thumbnails progressively
    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      const progress = Math.round(((i + 1) / dates.length) * 100);
      
      updateStatus(`Fetching frame ${i + 1} of ${dates.length} (${progress}%)`);
      
      try {
        const frameUrl = await fetchStaticFrame(date);
        if (frameUrl) {
          state.builtFrameUrls.push(frameUrl);
          state.builtImages.push(date);
          
          // Add thumbnail immediately after each successful fetch
          const thumbnail = createThumbnail(frameUrl, date, state.builtFrameUrls.length - 1);
          if (elements.thumbnailsScroll) {
            // Remove placeholder if it's the first thumbnail
            if (state.builtFrameUrls.length === 1) {
              elements.thumbnailsScroll.innerHTML = '';
            }
            elements.thumbnailsScroll.appendChild(thumbnail);
          }
          updateFrameCount();
        }
      } catch (error) {
        console.warn(`Failed to fetch frame for ${formatDateForDisplay(date)}:`, error);
      }
    }
    
    hideLoading();
    
    if (state.builtFrameUrls.length > 0) {
      updateStatus(`Built ${state.builtFrameUrls.length} frames successfully`);
      
      // Enable buttons
      if (elements.playBtn) elements.playBtn.disabled = false;
      if (elements.downloadBtn) elements.downloadBtn.disabled = false;
      
    } else {
      updateStatus('Failed to build any frames');
    }
    
    state.isBuilding = false;
    
    if (elements.buildBtn) {
      elements.buildBtn.disabled = false;
      elements.buildBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
        </svg>
        Build
      `;
    }
  }

  // Download Functionality
  function downloadVideo() {
    if (!state.builtVideoBlob) {
      updateStatus('No video to download. Build first.');
      return;
    }
    
    const dateRange = `${elements.fromDate.value}_to_${elements.toDate.value}`;
    const filename = `sea_surface_temperature_${dateRange}.webm`;
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(state.builtVideoBlob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    updateStatus(`Downloaded: ${filename}`);
  }

  // Event Handlers
  function setupEventListeners() {
    // Build button
     if (elements.buildBtn) {
       elements.buildBtn.addEventListener('click', buildFrames);
     }
    
    // Play button
    if (elements.playBtn) {
      elements.playBtn.addEventListener('click', () => {
        if (state.isPlaying) {
          stopPlayback();
        } else {
          startPlayback();
        }
      });
    }
    
    // Download button
    if (elements.downloadBtn) {
      elements.downloadBtn.addEventListener('click', downloadVideo);
    }
    
    // Date controls
    if (elements.fromDate) {
      elements.fromDate.addEventListener('change', () => {
        updateLayers();
      });
    }
    
    if (elements.toDate) {
      elements.toDate.addEventListener('change', () => {
        updateLayers();
      });
    }
    
    // Initialize layers dropdown
    initLayersDropdown();
  }

  // Initialization
  function init() {
    // Get DOM elements
    elements.map = document.getElementById('map');
    elements.status = document.getElementById('status');
    elements.buildBtn = document.getElementById('buildBtn');
    elements.playBtn = document.getElementById('playBtn');
    elements.downloadBtn = document.getElementById('downloadBtn');
    elements.fromDate = document.getElementById('fromDate');
    elements.toDate = document.getElementById('toDate');
    elements.datePicker = document.getElementById('datePicker');
    elements.layersButton = document.getElementById('layersButton');
    elements.layersDropdown = document.getElementById('layersDropdown');
    elements.sstLayer = document.getElementById('sstLayer');
    elements.frameOverlay = document.getElementById('framePlayer');
    elements.frameImage = document.getElementById('frameImage');
    elements.loadingIndicator = document.getElementById('loadingIndicator');
    elements.loadingText = document.getElementById('loadingText');
    elements.frameCount = document.getElementById('frameCount');

    // Set default dates
    if (elements.fromDate) elements.fromDate.value = CONFIG.defaultDateRange.start;
    if (elements.toDate) elements.toDate.value = CONFIG.defaultDateRange.end;
    if (elements.datePicker) elements.datePicker.value = CONFIG.defaultDateRange.start;

    // Initialize map
    initMap();
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize layers dropdown
    initLayersDropdown();
    
    // Initial status
    updateStatus('Ready - Select date range and click Build to start');
  }

  // Layers dropdown functionality
  function initLayersDropdown() {
    const layersButton = elements.layersButton;
    const layersDropdown = elements.layersDropdown;
    const sstLayerCheckbox = elements.sstLayer;

    // Initialize dropdown even if the checkbox isn't present yet
    if (!layersButton || !layersDropdown) return;

    // Toggle dropdown
    layersButton.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !layersDropdown.classList.contains('opacity-0');
      if (isOpen) {
        // Close dropdown
        layersDropdown.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
        layersDropdown.classList.remove('opacity-100', 'scale-100', 'pointer-events-auto');
      } else {
        // Open dropdown
        layersDropdown.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
        layersDropdown.classList.add('opacity-100', 'scale-100', 'pointer-events-auto');
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!layersButton.contains(e.target) && !layersDropdown.contains(e.target)) {
        layersDropdown.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
        layersDropdown.classList.remove('opacity-100', 'scale-100', 'pointer-events-auto');
      }
    });

    // Sea Surface Temperature Layer Toggle
    if (sstLayerCheckbox) {
      sstLayerCheckbox.addEventListener('change', () => {
        if (sstLayerCheckbox.checked) {
          state.layerState.sst.visible = true;
        } else {
          state.layerState.sst.visible = false;
        }
        updateLayers();
      });
    }
  }

  // Start the application
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  


})();


