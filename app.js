(() => {
  const $ = sel => document.querySelector(sel);

  const DEFAULTS = {
    mode: 'whitelist',
    patterns: [],
    parentPinHash: null
  };

  async function sha256hex(str){
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
  }

  const STORAGE_KEY = 'ytFilteredPlayerConfigV1';

  function loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      const cfg = JSON.parse(raw);
      return { ...DEFAULTS, ...cfg };
    } catch { return { ...DEFAULTS }; }
  }

  function saveConfig(cfg) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }

  const videoUrl = $('#videoUrl');
  const loadBtn = $('#loadBtn');
  const player = $('#ytPlayer');
  const statusMsg = $('#statusMsg');
  const dlg = $('#settingsDialog');
  const openSettings = $('#openSettings');
  const lockPane = $('#lockPane');
  const settingsPane = $('#settingsPane');
  const pinInput = $('#pinInput');
  const unlockBtn = $('#unlockBtn');
  const patternsTxt = $('#patterns');
  const saveBtn = $('#saveBtn');
  const lockBtn = $('#lockBtn');

  let cfg = loadConfig();

  function uiStatus(msg, ok=false){
    statusMsg.textContent = msg;
    statusMsg.style.borderColor = ok ? '#205d2a' : '#343842';
    statusMsg.style.background = ok ? '#0f2013' : '#16181d';
  }

  function getSelectedMode() {
    const sel = document.querySelector('input[name="mode"]:checked');
    return sel ? sel.value : 'whitelist';
  }

  function setSelectedMode(mode) {
    const input = document.querySelector(`input[name="mode"][value="${mode}"]`);
    if (input) input.checked = true;
  }

  function hydrateSettings() {
    setSelectedMode(cfg.mode);
    patternsTxt.value = (cfg.patterns || []).join('\n');
  }

  function readSettingsFromUI() {
    cfg.mode = getSelectedMode();
    cfg.patterns = patternsTxt.value.split('\n').map(s => s.trim()).filter(Boolean);
  }

  function matchesPattern(authorUrl, authorName) {
    const hay = `${(authorUrl||'')}|${(authorName||'')}`.toLowerCase();
    return (cfg.patterns||[]).some(p => hay.includes(p.toLowerCase()));
  }

  function extractVideoId(url) {
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtu.be')) return u.pathname.replace('/','');
      if (u.searchParams.has('v')) return u.searchParams.get('v');
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2];
      return null;
    } catch { return null; }
  }

  async function checkVideoAllowed(videoId) {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`;
    try {
      const res = await fetch(oembedUrl, { mode: 'cors' });
      if (!res.ok) throw new Error('oEmbed non disponibile');
      const data = await res.json();
      const authorUrl = data.author_url || '';
      const authorName = data.author_name || '';
      const hit = matchesPattern(authorUrl, authorName);
      return cfg.mode === 'blacklist' ? !hit : hit;
    } catch (e) {
      console.error(e);
      return cfg.mode === 'blacklist';
    }
  }

  function playVideo(videoId){
    const src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?rel=0&modestbranding=1&autoplay=1`;
    player.src = src;
  }

  async function handleLoad(){
    const url = videoUrl.value.trim();
    const vid = extractVideoId(url);
    if (!vid) { uiStatus('URL non valido.'); return; }
    uiStatus('Verifico canale del video…');
    const allowed = await checkVideoAllowed(vid);
    if (!allowed) { player.src=''; uiStatus('❌ Video bloccato.'); return; }
    uiStatus('✅ Video consentito.', true);
    playVideo(vid);
  }

  async function isPinValid(inputPin) {
    const hash = await sha256hex(inputPin || '0000');
    if (!cfg.parentPinHash) return (await sha256hex('0000')) === hash;
    return cfg.parentPinHash === hash;
  }

  async function unlockSettings() {
    const ok = await isPinValid(pinInput.value || '');
    if (!ok) { alert('PIN errato'); return; }
    hydrateSettings();
    lockPane.hidden = true;
    settingsPane.hidden = false;
  }

  async function saveSettings() {
    readSettingsFromUI();
    const newPin = document.querySelector('#newPin').value.trim();
    if (newPin) cfg.parentPinHash = await sha256hex(newPin);
    saveConfig(cfg);
    alert('Impostazioni salvate');
  }

  function lockSettings(){
    settingsPane.hidden = true;
    lockPane.hidden = false;
    pinInput.value = '';
    const np = document.querySelector('#newPin'); if (np) np.value='';
  }

  loadBtn.addEventListener('click', handleLoad);
  videoUrl.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') handleLoad(); });
  openSettings.addEventListener('click', ()=>{ dlg.showModal(); lockSettings(); });
  unlockBtn.addEventListener('click', (e)=>{ e.preventDefault(); unlockSettings(); });
  saveBtn.addEventListener('click', (e)=>{ e.preventDefault(); saveSettings(); });
  lockBtn.addEventListener('click', (e)=>{ e.preventDefault(); lockSettings(); });

  uiStatus('Pronto. Imposta i canali da ⚙️ e incolla un link YouTube.');
})();