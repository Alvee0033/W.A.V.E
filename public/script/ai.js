// Basic AI chat interactivity: chip selection, suggestions, and mock replies

// Gemini integration + base chat interactions
(function(){
  const anomalyChips = document.querySelectorAll('#anomalyChips .chip');
  const layerChips = document.querySelectorAll('#layerChips .chip');
  const userInput = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');
  const messages = document.getElementById('chatMessages');
  const suggs = document.querySelectorAll('.sugg');

  // Use the provided Gemini API key
  const GEMINI_API_KEY = 'AIzaSyCGYNwiZz-LZSURDdQZhmLVFTRI6cjtqm8';
  // Prefer user's requested fast model; fall back if unavailable
  const GEMINI_MODEL_PREF = 'gemini-2.0-flash';
  const GEMINI_MODEL_FALLBACK = 'gemini-2.5-flash';

  function toggleChip(chip){ chip.classList.toggle('active'); }
  anomalyChips.forEach(c => c.addEventListener('click', () => toggleChip(c)));
  layerChips.forEach(c => c.addEventListener('click', () => toggleChip(c)));

  function getSelected(selector){
    return Array.from(document.querySelectorAll(`${selector} .chip.active`)).map(c => c.dataset.value);
  }

  function addMessage(type, text){
    const wrap = document.createElement('div');
    wrap.className = `msg ${type}`;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;
    wrap.appendChild(bubble);
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
  }

  function composeContextSummary(){
    const anomalies = getSelected('#anomalyChips');
    const layers = getSelected('#layerChips');
    const from = document.getElementById('ctxFrom').value || 'any';
    const to = document.getElementById('ctxTo').value || 'latest';
    const aStr = anomalies.length ? anomalies.join(', ') : 'All';
    const lStr = layers.length ? layers.join(', ') : 'BlueMarble, IMERG, GHRSST, MODIS';
    let earthCtx = window.__earthCtx || null;
    let extra = '';
    if (earthCtx) {
      const tDate = earthCtx.timelineDate || 'n/a';
      const cam = earthCtx.camera ? `[${(earthCtx.camera.lon||0).toFixed(2)}, ${(earthCtx.camera.lat||0).toFixed(2)} @ ${(earthCtx.camera.height||0).toFixed(0)}m]` : 'n/a';
      extra = ` timeline=${tDate}; camera=${cam}`;
    }
    return `Context → Anomalies: ${aStr}; Layers: ${lStr}; Date: ${from} → ${to}.${extra}`;
  }

  function mockAIReply(userText){
    const ctx = composeContextSummary();
    const guidance = `Here’s a context-aware take on: "${userText}"\n\n` +
      `- Using ${ctx}\n` +
      `- For precipitation: IMERG provides 30‑min rain/snow rates for event detection.\n` +
      `- For SST: GHRSST MUR blends multi-sensor fields for anomaly tracking.\n` +
      `- For aerosols: AOD indicates dust/haze transport intensity and extent.\n` +
      `- For reanalysis/forecast: ERA5 & CMIP aid climatology and scenario comparison.`;
    return guidance;
  }

  // Extract user-provided event details like name, ISO date, and coords
  function extractEventFromUserText(t){
    try {
      const nameMatch = t.match(/(Tropical\s+Storm|Hurricane|Cyclone|Typhoon)\s+([A-Za-z\-]+)/i);
      const isoMatch = t.match(/\b(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\b/);
      const coordMatch = t.match(/\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/);
      if (!nameMatch && !isoMatch && !coordMatch) return null;
      return {
        type: nameMatch ? nameMatch[1] : null,
        name: nameMatch ? nameMatch[2] : null,
        date: isoMatch ? isoMatch[1] : null,
        lon: coordMatch ? parseFloat(coordMatch[1]) : null,
        lat: coordMatch ? parseFloat(coordMatch[2]) : null
      };
    } catch(_) { return null; }
  }

  async function generateGeminiReply(userText){
    const ctx = composeContextSummary();
    const userEvent = extractEventFromUserText(userText);
    // Read anomalies summary saved by Earth page
    function readAnomalies(){
      try {
        const raw = localStorage.getItem('earthAnomalies');
        if (!raw) return null; return JSON.parse(raw);
      } catch(_) { return null; }
    }
    const anomalies = readAnomalies();
    function fmtEvent(ev){
      if (!ev) return null;
      const loc = (typeof ev.lat === 'number' && typeof ev.lon === 'number') ? `[${ev.lon.toFixed(2)}, ${ev.lat.toFixed(2)}]` : 'unknown location';
      return `${ev.title || 'Event'} — ${ev.date || 'unknown date'} — ${loc}`;
    }
    const facts = [];
    if (anomalies && anomalies.latestByCategory) {
      const latestStorm = anomalies.latestByCategory.severeStorms;
      const latestFlood = anomalies.latestByCategory.floods;
      const latestWild = anomalies.latestByCategory.wildfires;
      const latestDust = anomalies.latestByCategory.dustHaze;
      if (latestStorm) facts.push(`Latest severe storm: ${fmtEvent(latestStorm)}`);
      if (latestFlood) facts.push(`Latest flood: ${fmtEvent(latestFlood)}`);
      if (latestWild) facts.push(`Latest wildfire: ${fmtEvent(latestWild)}`);
      if (latestDust) facts.push(`Latest dust/haze: ${fmtEvent(latestDust)}`);
    }
    if (userEvent) {
      const loc = (typeof userEvent.lat === 'number' && typeof userEvent.lon === 'number') ? `[${userEvent.lon.toFixed(2)}, ${userEvent.lat.toFixed(2)}]` : 'unknown location';
      facts.unshift(`User-stated event: ${userEvent.type || 'Storm'} ${userEvent.name || ''} — ${userEvent.date || 'unknown date'} — ${loc}`.trim());
    }
    const factsBlock = facts.length ? (`Factual context from NASA EONET anomalies:\n- ${facts.join('\n- ')}`) : 'No live anomalies context available.';
    const prompt = `You are an Earth science assistant. Use provided factual context strictly and augment with domain knowledge. Return ONLY valid JSON with keys: summary, insights, references, metrics, recommendations. Do not include markdown or decorative symbols.\n\n${factsBlock}\n\nIf a user-stated event is present, treat it as authoritative for analysis. Estimate or infer where needed, and include uncertainty.\n\nRequired JSON schema:\n{\n  "summary": string,\n  "insights": string[],\n  "references": string[],\n  "metrics": {\n    "rain_rate_mm_per_hr": string,\n    "wind_direction": string,\n    "track_direction": string,\n    "origin": string,\n    "coordinates": string,\n    "confidence": number\n  },\n  "recommendations": string[]\n}\n\nContext chips: ${ctx}\nQuestion: ${userText}`;

    async function callModel(model){
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }]}],
          generationConfig: {
            responseMimeType: 'application/json',
            response_mime_type: 'application/json',
            maxOutputTokens: 512,
            temperature: 0.2,
            topP: 0.9
          }
        })
      });
      return res;
    }

    let res = await callModel(GEMINI_MODEL_PREF);
    if (!res.ok) {
      // Fallback for speed and reliability
      res = await callModel(GEMINI_MODEL_FALLBACK);
      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
    }
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map(p => p.text).filter(Boolean).join('\n');
    return text || 'No response from Gemini.';
  }

  function addPendingAI(){
    const wrap = document.createElement('div');
    wrap.className = 'msg ai';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = 'Thinking…';
    wrap.appendChild(bubble);
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  }

  async function handleSend(text){
    if(!text) return;
    addMessage('user', text);
    const bubble = addPendingAI();
    try {
      const reply = await generateGeminiReply(text);
      const obj = tryParseJSON(reply);
      if (obj) {
        bubble.classList.add('card');
        bubble.innerHTML = renderJSONCard(obj);
        // Append Map & Imagery section when coordinates are available
        const userEvent = extractEventFromUserText(text);
        function readAnomalies(){ try { const raw = localStorage.getItem('earthAnomalies'); return raw ? JSON.parse(raw) : null; } catch(_) { return null; } }
        const anomalies = readAnomalies();
        function pickEvent(){
          if (userEvent && typeof userEvent.lat === 'number' && typeof userEvent.lon === 'number') {
            return { title: `${userEvent.type || 'Storm'} ${userEvent.name || ''}`.trim(), date: userEvent.date || null, lat: userEvent.lat, lon: userEvent.lon, category: 'severeStorms' };
          }
          const latest = anomalies?.latestByCategory || {};
          return latest.severeStorms || latest.floods || latest.wildfires || latest.dustHaze || null;
        }
        const ev = pickEvent();
        if (ev && typeof ev.lat === 'number' && typeof ev.lon === 'number'){
          const mapId = `map-${Date.now()}`;
          function buildWorldviewUrl(category, dateStr, lon, lat, title){
            const span = 12; const minLon = Math.max(-180, lon - span); const maxLon = Math.min(180, lon + span);
            const minLat = Math.max(-90, lat - span/2); const maxLat = Math.min(90, lat + span/2);
            const trueColor = 'VIIRS_NOAA21_CorrectedReflectance_TrueColor';
            const precip = 'IMERG_Precipitation_Rate_30min';
            const labels = 'Reference_Labels_15m'; const features = 'Reference_Features_15m'; const coast = 'Coastlines_15m(hidden)';
            const showPrecip = (category === 'severeStorms' || category === 'floods');
            const layers = [labels, features, coast, trueColor].concat(showPrecip ? [precip] : []);
            const t = (new Date(dateStr || new Date())).toISOString().slice(0,10) + '-T00%3A00%3A00Z';
            const v = `${minLon},${minLat},${maxLon},${maxLat}`;
            return `https://worldview.earthdata.nasa.gov/?v=${encodeURIComponent(v)}&z=4&ics=true&ici=5&icd=30&l=${encodeURIComponent(layers.join(','))}&lg=false&t=${t}`;
          }
          const wvUrl = buildWorldviewUrl(ev.category || 'severeStorms', ev.date, ev.lon, ev.lat, ev.title);
          const mapSectionHTML = `
            <div class="section">
              <div class="section-title">Map & Imagery</div>
              <div class="image-row">
                <div id="${mapId}" class="map-preview" aria-label="Map preview"></div>
                <div class="image-actions">
                  <a href="${wvUrl}" target="_blank" rel="noopener" class="wv-btn">Open in NASA Worldview</a>
                </div>
              </div>
            </div>`;
          const cardEl = bubble.querySelector('.card');
          if (cardEl) cardEl.insertAdjacentHTML('beforeend', mapSectionHTML);
          // Initialize Leaflet map if available
          setTimeout(() => {
            try {
              if (window.L && document.getElementById(mapId)){
                const map = L.map(mapId, { zoomControl: false, attributionControl: false }).setView([ev.lat, ev.lon], 5);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 10 }).addTo(map);
                L.marker([ev.lat, ev.lon]).addTo(map);
              }
            } catch(_){}
          }, 0);
        }
      } else {
        bubble.textContent = reply.replace(/\*+/g, '');
        if ('speechSynthesis' in window && reply) {
          const msg = new SpeechSynthesisUtterance(bubble.textContent); msg.rate = 1.0; msg.pitch = 1.0; msg.lang = 'en-US';
          window.speechSynthesis.speak(msg);
        }
      }
    } catch (e) {
      bubble.textContent = `Gemini error: ${e.message}`;
    }
  }

  sendBtn.addEventListener('click', () => handleSend(userInput.value.trim()));
  userInput.addEventListener('keydown', (e) => { if(e.key === 'Enter'){ handleSend(userInput.value.trim()); } });
  suggs.forEach(s => s.addEventListener('click', () => handleSend(s.textContent)));
})();

// Voice chat, mobile drawer, and Earth context sync
(function(){
  const userInput = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');
  const micBtn = document.getElementById('micBtn');
  const contextPanel = document.getElementById('contextPanel');
  const toggleContext = document.getElementById('toggleContext');
  const backdrop = document.getElementById('drawerBackdrop');
  const messages = document.getElementById('chatMessages');
  const chatInput = document.querySelector('.chat-input');

  // Mobile drawer toggle
  function openDrawer(){ contextPanel?.classList.add('open'); backdrop?.classList.add('show'); toggleContext?.setAttribute('aria-expanded','true'); }
  function closeDrawer(){ contextPanel?.classList.remove('open'); backdrop?.classList.remove('show'); toggleContext?.setAttribute('aria-expanded','false'); }
  toggleContext?.addEventListener('click', () => { const isOpen = contextPanel?.classList.contains('open'); (isOpen ? closeDrawer : openDrawer)(); });
  backdrop?.addEventListener('click', closeDrawer);

  // Speech recognition
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  if (SR) {
    recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    let finalTranscript = '';
    recognition.onstart = () => { if (micBtn){ micBtn.classList.add('listening'); micBtn.textContent = '🟢'; } };
    recognition.onresult = (e) => {
      finalTranscript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTranscript += t;
      }
      if (userInput && finalTranscript) userInput.value = finalTranscript.trim();
    };
    recognition.onerror = () => { if (micBtn){ micBtn.classList.remove('listening'); micBtn.textContent = '🎤'; } };
    recognition.onend = () => {
      if (micBtn){ micBtn.classList.remove('listening'); micBtn.textContent = '🎤'; }
      const text = userInput?.value?.trim();
      if (text) { sendBtn?.click(); }
    };
    micBtn?.addEventListener('click', () => { try { recognition.start(); } catch(_){} });
  } else {
    micBtn?.addEventListener('click', () => alert('Voice input not supported in this browser.'));
  }

  // Text-to-speech for AI replies
  function speak(text){
    if (!('speechSynthesis' in window) || !text) return;
    const msg = new SpeechSynthesisUtterance(text);
    msg.rate = 1.0; msg.pitch = 1.0; msg.lang = 'en-US';
    window.speechSynthesis.speak(msg);
  }
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType === 1 && node.classList.contains('msg') && node.classList.contains('ai')) {
          const bubble = node.querySelector('.bubble');
          if (bubble) speak(bubble.textContent || '');
        }
      });
    });
  });
  if (messages) observer.observe(messages, { childList: true });

  // Auto-sync Earth context
  function parseCtxFromParam(){
    const url = new URL(window.location.href);
    const ctxParam = url.searchParams.get('ctx');
    if (!ctxParam) return null; try { return JSON.parse(atob(ctxParam)); } catch { return null; }
  }
  function readLocalCtx(){
    const raw = localStorage.getItem('earthContext');
    if (!raw) return null; try { return JSON.parse(raw); } catch { return null; }
  }
  function applyCtx(ctx){
    if (!ctx) return;
    const map = { wildfires: 'Wildfires', floods: 'Floods', severeStorms: 'Storms', dustHaze: 'Dust & Haze', all: 'All' };
    const target = map[ctx.anomaliesFilter] || null;
    if (target) {
      document.querySelectorAll('#anomalyChips .chip').forEach(c => { c.classList.toggle('active', c.dataset.value === target); });
    }
    if (ctx.anomalyRange) {
      const f = document.getElementById('ctxFrom'); const t = document.getElementById('ctxTo');
      if (f && ctx.anomalyRange.from) f.value = ctx.anomalyRange.from;
      if (t && ctx.anomalyRange.to) t.value = ctx.anomalyRange.to;
    }
    if (ctx.layers && typeof ctx.layers === 'object') {
      const layerMap = { NDVI:'NDVI', LST:'LST', GEDI:'GEDI', MOPITT:'MOPITT', CO:'CO', MISR:'MISR', Labels:'Labels', Settlements:'Settlements', CloudPressure:'CloudPressure', CeresFlux:'CeresFlux', BlueMarble:'BlueMarble', IMERG:'IMERG', AOD:'AOD', MODIS:'MODIS', VIIRS:'VIIRS' };
      Object.keys(ctx.layers).forEach(k => { const label = layerMap[k]; if (!label) return; const chip = document.querySelector(`#layerChips .chip[data-value="${label}"]`); if (chip) chip.classList.toggle('active', !!ctx.layers[k]); });
    }
    window.__earthCtx = ctx;
  }
  const initialCtx = parseCtxFromParam() || readLocalCtx(); if (initialCtx) applyCtx(initialCtx);
  setInterval(() => { const lc = readLocalCtx(); if (lc) applyCtx(lc); }, 5000);

  // Ensure messages never hide under input: dynamic bottom padding
  function updateMessagesPad(){
    const h = chatInput ? chatInput.offsetHeight : 80;
    messages?.style?.setProperty('--messages-pad-bottom', `${h + 24}px`);
  }
  updateMessagesPad();
  window.addEventListener('resize', updateMessagesPad);
  if (window.ResizeObserver && chatInput) {
    const ro = new ResizeObserver(updateMessagesPad); ro.observe(chatInput);
  }

  // Auto-fetch EONET anomalies so AI has context without opening Earth page
  function parseISODateSafe(s){ const d = new Date(s); return isNaN(d.getTime()) ? 0 : d.getTime(); }
  function buildAnomalySummary(all){
    const byCat = { wildfires: [], floods: [], dustHaze: [], severeStorms: [] };
    all.forEach(rec => { if (rec && rec.category && byCat[rec.category]) byCat[rec.category].push(rec); });
    Object.keys(byCat).forEach(k => byCat[k].sort((a,b) => parseISODateSafe(b.date) - parseISODateSafe(a.date)));
    const latestByCategory = {}; Object.keys(byCat).forEach(k => { if (byCat[k][0]) latestByCategory[k] = byCat[k][0]; });
    const topRecent = all.slice().sort((a,b) => parseISODateSafe(b.date) - parseISODateSafe(a.date)).slice(0, 100);
    return { lastUpdated: new Date().toISOString(), counts: Object.fromEntries(Object.keys(byCat).map(k => [k, byCat[k].length])), latestByCategory, topRecent };
  }
  async function refreshAnomaliesIfNeeded(){
    const STALE_MINUTES = 10;
    try {
      const raw = localStorage.getItem('earthAnomalies');
      if (raw) {
        const obj = JSON.parse(raw);
        const last = obj?.lastUpdated ? new Date(obj.lastUpdated).getTime() : 0;
        if (Date.now() - last < STALE_MINUTES*60*1000) return; // still fresh
      }
    } catch(_) {}
    const now = new Date();
    const endISO = now.toISOString().slice(0,10);
    const startISO = new Date(now.getTime() - 120*24*60*60*1000).toISOString().slice(0,10);
    const cats = [
      { id: 'wildfires', url: `https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&start=${startISO}&end=${endISO}` },
      { id: 'floods', url: `https://eonet.gsfc.nasa.gov/api/v3/events?category=floods&start=${startISO}&end=${endISO}` },
      { id: 'dustHaze', url: `https://eonet.gsfc.nasa.gov/api/v3/events?category=dustHaze&start=${startISO}&end=${endISO}` },
      { id: 'severeStorms', url: `https://eonet.gsfc.nasa.gov/api/v3/events?category=severeStorms&start=${startISO}&end=${endISO}` }
    ];
    const all = [];
    await Promise.all(cats.map(async (cfg) => {
      try {
        const json = await fetch(cfg.url).then(r => r.json());
        const events = Array.isArray(json?.events) ? json.events : [];
        events.forEach(evt => {
          const title = evt.title || 'Event';
          const geoms = Array.isArray(evt.geometry) ? evt.geometry : [];
          geoms.forEach(g => {
            const when = g.date || '';
            const coords = g.coordinates;
            let lat = null, lon = null;
            if (Array.isArray(coords) && typeof coords[0] === 'number' && typeof coords[1] === 'number') { lon = coords[0]; lat = coords[1]; }
            all.push({ category: cfg.id, title, date: when, lon, lat });
          });
        });
      } catch(_) {}
    }));
    if (all.length) {
      const summary = buildAnomalySummary(all);
      try { localStorage.setItem('earthAnomalies', JSON.stringify(summary)); } catch(_) {}
    }
  }
  // Kick off on load and refresh periodically
  refreshAnomaliesIfNeeded();
  setInterval(refreshAnomaliesIfNeeded, 10*60*1000);
})();
  function escapeHtml(str){
    return str.replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
  }
  function tryParseJSON(text){
    try { return JSON.parse(text); } catch(_) {
      const start = text.indexOf('{'); const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        try { return JSON.parse(text.slice(start, end+1)); } catch(__) {}
      }
      return null;
    }
  }
  function renderJSONCard(obj){
    const s = (obj.summary ?? '').toString();
    const insights = Array.isArray(obj.insights) ? obj.insights : [];
    const refs = Array.isArray(obj.references) ? obj.references : [];
    const safe = (x) => escapeHtml(x.toString());
    const li = insights.map(i => `<li>${safe(i)}</li>`).join('');
    const ref = refs.map(r => `<li>${safe(r)}</li>`).join('');
    return `
      <div class="card">
        ${s ? `<div class="section"><div class="section-title">Summary</div><p>${safe(s)}</p></div>` : ''}
        ${insights.length ? `<div class="section"><div class="section-title">Insights</div><ul>${li}</ul></div>` : ''}
        ${refs.length ? `<div class="section"><div class="section-title">References</div><ul class="refs">${ref}</ul></div>` : ''}
      </div>`;
  }
// Voice conversation: STT (Web Speech API) + TTS (speechSynthesis)
(() => {
  const voiceBtn = document.getElementById('voiceBtn');
  const sendBtn = document.getElementById('sendBtn');
  const userInput = document.getElementById('userInput');
  const chatMessages = document.getElementById('chatMessages');
  const voiceOrb = document.getElementById('voiceOrb');
  const voiceStatus = document.getElementById('voiceStatus');

  if (!voiceBtn || !sendBtn || !userInput || !chatMessages) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supportsSTT = !!SpeechRecognition;
  const supportsTTS = 'speechSynthesis' in window;

  let recognition = null;
  let listening = false;

  function setVoiceBtnActive(active) {
    listening = active;
    voiceBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    voiceBtn.classList.toggle('ring-2', active);
    voiceBtn.classList.toggle('ring-emerald-400/60', active);
    voiceBtn.querySelector('span')?.classList.toggle('text-emerald-300', active);
  }

  function showVoiceUI() {
    voiceOrb?.classList.remove('hidden');
  }
  function hideVoiceUI() {
    voiceOrb?.classList.add('hidden');
  }
  function setStatus(msg) {
    if (voiceStatus) voiceStatus.textContent = msg;
  }

  function speak(text) {
    if (!supportsTTS || !text) return;
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.0;
      utter.pitch = 1.0;
      utter.volume = 1.0;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn('TTS error:', e);
    }
  }

  function extractSpeakableText(node) {
    // Prefer a structured summary if present; else fallback to bubble text.
    const summary = node.querySelector('[data-speak-summary]');
    if (summary) return summary.textContent?.trim() || '';
    const bubble = node.querySelector('.bubble');
    if (bubble) return bubble.textContent?.trim() || '';
    // Fallback: entire node text
    return node.textContent?.trim() || '';
  }

  function handleRecognitionResult(event) {
    if (!event.results) return;
    let finalText = '';
    let interimText = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      if (res.isFinal) {
        finalText += res[0].transcript;
      } else {
        interimText += res[0].transcript;
      }
    }
    interimText = interimText.trim();
    if (interimText) {
      userInput.value = interimText;
      setStatus('Listening…');
    }
    finalText = finalText.trim();
    if (finalText) {
      userInput.value = finalText;
      setStatus('Sending…');
      sendBtn.click();
      stopListening();
      hideVoiceUI();
    }
  }

  function startListening() {
    if (!supportsSTT) return;
    if (listening) return;
    if (!recognition) {
      recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onresult = handleRecognitionResult;
      recognition.onerror = (e) => {
        console.warn('STT error:', e);
        setVoiceBtnActive(false);
        hideVoiceUI();
      };
      recognition.onend = () => {
        hideVoiceUI();
        setVoiceBtnActive(false);
      };
    }
    try {
      recognition.start();
      setVoiceBtnActive(true);
      showVoiceUI();
      setStatus('Listening…');
    } catch (e) {
      console.warn('STT start error:', e);
    }
  }

  function stopListening() {
    if (!recognition) return;
    try { recognition.stop(); } catch {}
    setVoiceBtnActive(false);
    hideVoiceUI();
  }

  // Toggle button
  voiceBtn.addEventListener('click', () => {
    if (!supportsSTT && !supportsTTS) {
      voiceBtn.title = 'Voice features not supported in this browser';
      return;
    }
    if (listening) stopListening(); else startListening();
  });

  // Auto-speak new AI messages
  if (supportsTTS) {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((n) => {
          if (!(n instanceof HTMLElement)) return;
          if (n.classList.contains('msg') && n.classList.contains('ai')) {
            const text = extractSpeakableText(n);
            if (text) speak(text);
          }
        });
      }
    });
    observer.observe(chatMessages, { childList: true });
  }
})();