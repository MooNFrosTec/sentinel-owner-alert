(() => {
  const LOG_PREFIX = '[Sentinel Owner Alert]';
  const SEVERITIES = ['Critical', 'High', 'Medium', 'Low', 'Informational'];
  const STATUS_VALUES = ['New', 'Active', 'Closed'];
  const RECENT_LIMIT = 30;
  const RECENT_TTL_MS = 6 * 60 * 60 * 1000;

  let knownRows = new Map();
  let timer = null;
  let debounceTimer = null;
  let checks = 0;
  let lastSignature = '';
  let lastAutoRefreshAlertAt = 0;
  let autoRefreshBannerSignature = '';
  let activeScanPromise = null;
  let pendingScanReason = '';

  const DEFAULTS = {
    enabled: true,
    volume: 0.8,
    intervalSeconds: 2,
    targetOwner: 'SOC_Tier_1',
    notifyOnExisting: false,
    repeatWhilePresent: false,
    repeatSoundSeconds: 10,
    customSoundDataUrl: '',
    desktopNotifications: true,
    severityFilterEnabled: false,
    severityFilter: {
      Critical: true,
      High: true,
      Medium: true,
      Low: true,
      Informational: true,
      Unknown: true
    },
    scheduleEnabled: false,
    scheduleStart: '08:00',
    scheduleEnd: '18:00',
    scheduleDays: [1, 2, 3, 4, 5],
    autoRefreshBannerEnabled: true,
    autoRefreshSoundEnabled: false,
    autoRefreshSoundSeconds: 60,
    autoRefreshAutoEnable: false
  };

  const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const ownerKey = (value) => normalize(value).toLowerCase().replace(/[\s_-]+/g, '');
  const isUnassigned = (value) => ownerKey(value) === 'unassigned';
  const isTargetOwner = (value, targetOwner) => ownerKey(value) === ownerKey(targetOwner);

  function mergeConfig(raw) {
    const cfg = { ...DEFAULTS, ...(raw || {}) };
    cfg.severityFilter = { ...DEFAULTS.severityFilter, ...((raw && raw.severityFilter) || {}) };

    // Migration support for experimental v3.0 popup keys.
    if (raw && raw.severityLevels && typeof raw.severityLevels === 'object') {
      cfg.severityFilter = {
        Critical: raw.severityLevels.critical !== false,
        High: raw.severityLevels.high !== false,
        Medium: raw.severityLevels.medium !== false,
        Low: raw.severityLevels.low !== false,
        Informational: raw.severityLevels.informational !== false,
        Unknown: raw.includeUnknownSeverity !== false
      };
    }

    if (Array.isArray(raw && raw.scheduleDays)) {
      cfg.scheduleDays = raw.scheduleDays.map(Number).filter((day) => day >= 0 && day <= 6);
    } else if (raw && raw.scheduleDays && typeof raw.scheduleDays === 'object') {
      cfg.scheduleDays = Object.entries(raw.scheduleDays)
        .filter((entry) => entry[1] !== false)
        .map((entry) => Number(entry[0]))
        .filter((day) => day >= 0 && day <= 6);
    } else {
      cfg.scheduleDays = DEFAULTS.scheduleDays.slice();
    }

    cfg.severityFilterEnabled = raw && raw.severityFilterEnabled === true;
    return cfg;
  }

  function isAzureSentinelPage() {
    const href = location.href || '';
    if (href.includes('Microsoft_Azure_Security_Insights')) return true;
    const text = document.body ? document.body.innerText || '' : '';
    return text.includes('Microsoft Sentinel') || text.includes('Incidents') || text.includes('Incident');
  }


  function findAutoRefreshToggle() {
    const candidates = [
      ...document.querySelectorAll('button[aria-label], [role="button"][aria-label], [aria-pressed][aria-label]')
    ];

    for (const element of candidates) {
      const label = normalize(element.getAttribute('aria-label') || element.getAttribute('title') || '');
      if (/auto[-\s]?refresh/i.test(label) && /incident/i.test(label)) {
        return element.closest('button,[role="button"]') || element;
      }
    }

    const allWithLabels = [...document.querySelectorAll('[aria-label], [title]')];
    for (const element of allWithLabels) {
      const label = normalize(`${element.getAttribute('aria-label') || ''} ${element.getAttribute('title') || ''}`);
      if (/auto[-\s]?refresh/i.test(label) && /incident/i.test(label)) {
        return element.closest('button,[role="button"]') || element;
      }
    }

    return null;
  }

  function getAutoRefreshState() {
    const toggle = findAutoRefreshToggle();
    if (!toggle) {
      return { found: false, enabled: null, label: '', ariaPressed: '', className: '' };
    }

    const ariaPressed = normalize(toggle.getAttribute('aria-pressed') || '');
    let enabled = null;
    if (ariaPressed.toLowerCase() === 'true') enabled = true;
    if (ariaPressed.toLowerCase() === 'false') enabled = false;

    const classText = normalize(`${toggle.className || ''} ${toggle.querySelector('*') ? toggle.querySelector('*').className || '' : ''}`);
    const inactiveChild = Boolean(toggle.querySelector('.fxs-toggle-button-inactive, .fxs-toggle-circle-inactive'));
    const activeChild = Boolean(toggle.querySelector('.fxs-toggle-button-active, .fxs-toggle-circle-active, .fxc-toggle-btn-content.fxs-toggle-button-active'));
    if (enabled === null && inactiveChild) enabled = false;
    if (enabled === null && (activeChild || /(?:^|[\s_-])active(?:$|[\s_-])/i.test(classText))) enabled = true;

    return {
      found: true,
      enabled,
      label: normalize(toggle.getAttribute('aria-label') || toggle.getAttribute('title') || 'Auto-refresh incidents'),
      ariaPressed,
      className: classText.slice(0, 160)
    };
  }

  async function enableAutoRefresh() {
    const toggle = findAutoRefreshToggle();
    const before = getAutoRefreshState();
    if (!toggle || before.enabled === true) return before;

    try {
      toggle.click();
      await new Promise((resolve) => setTimeout(resolve, 350));
      return getAutoRefreshState();
    } catch (e) {
      await setStatus({ lastError: `Auto-refresh click failed: ${String(e && e.message ? e.message : e)}` });
      return before;
    }
  }

  function removeAutoRefreshBanner() {
    autoRefreshBannerSignature = '';
    const old = document.getElementById('sentinel-owner-alert-auto-refresh-banner');
    if (old) old.remove();
  }

  function renderAutoRefreshBanner(state, cfg, isSentinel) {
    if (!isSentinel || cfg.enabled === false || cfg.autoRefreshBannerEnabled === false || !state.found || state.enabled !== false) {
      removeAutoRefreshBanner();
      return;
    }

    const signature = `${state.enabled}:${state.label}:${cfg.autoRefreshAutoEnable}`;
    let banner = document.getElementById('sentinel-owner-alert-auto-refresh-banner');
    if (banner && banner.getAttribute('data-signature') === signature) return;

    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'sentinel-owner-alert-auto-refresh-banner';
      banner.style.position = 'fixed';
      banner.style.top = '12px';
      banner.style.right = '18px';
      banner.style.zIndex = '2147483647';
      banner.style.maxWidth = '420px';
      banner.style.padding = '12px 14px';
      banner.style.background = '#7f1d1d';
      banner.style.color = '#fff';
      banner.style.border = '2px solid #ef4444';
      banner.style.borderRadius = '8px';
      banner.style.boxShadow = '0 8px 26px rgba(0,0,0,0.45)';
      banner.style.fontFamily = 'Arial, sans-serif';
      banner.style.fontSize = '13px';
      banner.style.lineHeight = '1.35';
      document.documentElement.appendChild(banner);
    }

    autoRefreshBannerSignature = signature;
    banner.setAttribute('data-signature', signature);
    banner.innerHTML = `
      <div style="font-weight:700;font-size:14px;margin-bottom:4px;">Sentinel Owner Alert: Auto-refresh je vypnuty</div>
      <div>Bez zapnuteho auto-refresh nemusi Azure Portal nacitat nove incidenty, takze rozsireni nemusi videt zmeny vcas.</div>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button id="sentinel-owner-alert-enable-auto-refresh" type="button" style="flex:1;padding:7px 10px;border:0;border-radius:5px;background:#fff;color:#7f1d1d;font-weight:700;cursor:pointer;">Zapnout auto-refresh</button>
        <button id="sentinel-owner-alert-dismiss-auto-refresh" type="button" style="padding:7px 10px;border:1px solid rgba(255,255,255,.5);border-radius:5px;background:transparent;color:#fff;cursor:pointer;">Skrýt</button>
      </div>`;

    const enableButton = document.getElementById('sentinel-owner-alert-enable-auto-refresh');
    if (enableButton) {
      enableButton.addEventListener('click', async () => {
        await enableAutoRefresh();
        await scan('auto-refresh-banner');
      }, { once: true });
    }

    const dismissButton = document.getElementById('sentinel-owner-alert-dismiss-auto-refresh');
    if (dismissButton) {
      dismissButton.addEventListener('click', () => removeAutoRefreshBanner(), { once: true });
    }
  }

  async function handleAutoRefreshState(cfg, isSentinel, reason) {
    let state = isSentinel ? getAutoRefreshState() : { found: false, enabled: null, label: '', ariaPressed: '', className: '' };

    if (isSentinel && cfg.enabled !== false && state.found && state.enabled === false && cfg.autoRefreshAutoEnable === true) {
      state = await enableAutoRefresh();
    }

    renderAutoRefreshBanner(state, cfg, isSentinel);

    if (isSentinel && cfg.enabled !== false && state.found && state.enabled === false && cfg.autoRefreshSoundEnabled === true) {
      const repeatSeconds = Math.max(10, Number(cfg.autoRefreshSoundSeconds || DEFAULTS.autoRefreshSoundSeconds));
      const due = Date.now() - lastAutoRefreshAlertAt >= repeatSeconds * 1000;
      if (due) {
        lastAutoRefreshAlertAt = Date.now();
        await playSound(cfg.volume, cfg.customSoundDataUrl);
        const lastAutoRefreshAlert = `${new Date().toLocaleTimeString()} Auto-refresh OFF`;
        await setStatus({ lastAutoRefreshAlert, lastError: '' });
        chrome.runtime.sendMessage({
          type: 'SENTINEL_OWNER_ALERT',
          title: 'Auto-refresh incidents is OFF',
          text: 'Auto-refresh incidents is OFF. New Sentinel incidents may not be loaded automatically.',
          severity: 'Warning',
          owner: cfg.targetOwner,
          reason: `auto-refresh disabled (${reason})`,
          href: location.href
        }).catch(() => {});
      }
    }

    return state;
  }

  async function getConfig() {
    const raw = await chrome.storage.local.get({
      ...DEFAULTS,
      severityLevels: null,
      includeUnknownSeverity: true
    });
    return mergeConfig(raw);
  }

  async function setStatus(patch) {
    try {
      const old = await chrome.storage.local.get({ lastStatus: {} });
      await chrome.storage.local.set({ lastStatus: { ...old.lastStatus, ...patch } });
    } catch (e) {
      console.warn(LOG_PREFIX, 'Unable to set status:', e);
    }
  }

  function makeStableId(parts) {
    return normalize(parts.filter(Boolean).join('|')).slice(0, 420);
  }

  function normalizeSeverity(value) {
    const text = normalize(value).toLowerCase();
    if (text === 'critical') return 'Critical';
    if (text === 'high') return 'High';
    if (text === 'medium') return 'Medium';
    if (text === 'low') return 'Low';
    if (text === 'informational' || text === 'info') return 'Informational';
    return '';
  }

  function findSeverity(cells, rowText) {
    for (const cell of cells) {
      const exact = normalizeSeverity(cell);
      if (exact) return exact;
    }

    const match = normalize(rowText).match(/\b(Critical|High|Medium|Low|Informational)\b/i);
    return match ? normalizeSeverity(match[1]) : 'Unknown';
  }

  function isStatusValue(value) {
    const text = normalize(value).toLowerCase();
    return STATUS_VALUES.some((status) => status.toLowerCase() === text);
  }

  function findStatus(cells) {
    return cells.find(isStatusValue) || '';
  }

  function looksLikeDate(value) {
    const text = normalize(value);
    return /\b\d{1,2}[./]\s*\d{1,2}[./]\s*\d{2,4}\b/.test(text) ||
      /\b\d{4}-\d{2}-\d{2}\b/.test(text) ||
      /\b\d{1,2}:\d{2}(:\d{2})?\b/.test(text);
  }

  function findCreated(cells) {
    return cells.find(looksLikeDate) || '';
  }

  function isOwnerValue(value, targetOwner) {
    const text = normalize(value);
    if (!text) return false;
    if (isUnassigned(text) || isTargetOwner(text, targetOwner)) return true;
    return looksLikeOwner(text, targetOwner);
  }

  function isLikelyTitleCandidate(value, targetOwner) {
    const text = normalize(value);
    if (!text) return false;
    if (normalizeSeverity(text)) return false;
    if (isOwnerValue(text, targetOwner)) return false;
    if (isStatusValue(text)) return false;
    if (looksLikeDate(text)) return false;
    if (/^\d+$/.test(text)) return false;
    if (/^(view|select|open|details|severity|title|owner|status|alerts|incident|incidents)$/i.test(text)) return false;
    return text.length >= 4;
  }

  function findTitle(cells, ownerIndex, severity, targetOwner, rowText, headerMap) {
    if (Number.isInteger(headerMap.title) && cells[headerMap.title] && isLikelyTitleCandidate(cells[headerMap.title], targetOwner)) {
      return cells[headerMap.title];
    }

    const severityIndex = cells.findIndex((cell) => normalizeSeverity(cell) === severity);
    if (severityIndex >= 0 && cells[severityIndex + 1] && isLikelyTitleCandidate(cells[severityIndex + 1], targetOwner)) {
      return cells[severityIndex + 1];
    }

    const beforeOwner = ownerIndex >= 0 ? cells.slice(0, ownerIndex) : cells;
    const candidate = beforeOwner.find((cell) => isLikelyTitleCandidate(cell, targetOwner));
    if (candidate) return candidate;

    return cells.find((cell) => isLikelyTitleCandidate(cell, targetOwner)) || normalize(rowText).slice(0, 120);
  }

  function extractLink(row, headerMap) {
    const cells = [...row.querySelectorAll('[role="gridcell"], [role="cell"], td, th')]
      .filter((cell) => normalize(cell.innerText || cell.textContent || ''));
    const titleCell = Number.isInteger(headerMap.title) ? cells[headerMap.title] : null;
    const incidentLink = titleCell && titleCell.querySelector('a[href]');
    const link = incidentLink || [...row.querySelectorAll('a[href]')]
      .find((candidate) => /incident/i.test(candidate.getAttribute('href') || ''));
    if (!link) return '';
    return link.href || link.getAttribute('href') || '';
  }

  function getCellTexts(row) {
    return [...row.querySelectorAll('[role="gridcell"], [role="cell"], td, th')]
      .map((cell) => normalize(cell.innerText || cell.textContent || ''))
      .filter(Boolean);
  }

  function getHeaderMap(root) {
    const map = {};
    const scope = root || document;
    const headerRows = [...scope.querySelectorAll('[role="row"], tr')];

    function applyHeaders(cells) {
      cells.forEach((cell, index) => {
        const text = normalize(cell).toLowerCase();
        if (!text) return;
        if (text === 'owner' || text.includes('owner')) map.owner = index;
        if (text === 'severity' || text.includes('severity')) map.severity = index;
        if (text === 'title' || text.includes('title')) map.title = index;
        if (text === 'status' || text.includes('status')) map.status = index;
        if (text.includes('created') || text.includes('creation time') || text.includes('created time')) map.created = index;
        if (text.includes('last updated')) map.updated = index;
      });
    }

    const directHeaders = [...scope.querySelectorAll('[role="columnheader"], th')]
      .map((cell) => normalize(cell.innerText || cell.textContent || ''))
      .filter(Boolean);
    if (directHeaders.length) applyHeaders(directHeaders);

    for (const row of headerRows) {
      const text = normalize(row.innerText || row.textContent || '');
      if (!/\b(Severity|Title|Owner|Status)\b/i.test(text)) continue;
      const cells = getCellTexts(row);
      if (cells.length) applyHeaders(cells);
    }

    return map;
  }

  function isIncidentHeaderMap(headerMap) {
    return Number.isInteger(headerMap.severity) &&
      Number.isInteger(headerMap.title) &&
      Number.isInteger(headerMap.owner);
  }

  function looksLikeOwner(value, targetOwner) {
    const text = normalize(value);
    const lower = text.toLowerCase();
    if (!text || text.length > 90) return false;
    if (normalizeSeverity(text) || isStatusValue(text) || looksLikeDate(text)) return false;
    if (/^\d+$/.test(text)) return false;
    if (/^(view|select|open|details|severity|title|owner|status|alerts)$/i.test(text)) return false;
    if (isUnassigned(text) || isTargetOwner(text, targetOwner)) return true;
    if (/\bSOC[\s_-]*Tier[\s_-]*\d+\b/i.test(text)) return true;
    if (/\bTier[\s_-]*\d+\b/i.test(text) && /\bSOC\b/i.test(text)) return true;
    if (/@/.test(text) && !/\s/.test(text)) return true;
    if (/^(soc|secops|tier|analyst)[\w\s_.-]{1,40}$/i.test(text)) return true;
    if (lower === 'assigned' || lower === 'not assigned') return true;
    return false;
  }

  function findOwner(cells, cfg, headerMap) {
    let ownerIndex = -1;
    let owner = '';

    if (Number.isInteger(headerMap.owner) && cells[headerMap.owner]) {
      ownerIndex = headerMap.owner;
      owner = cells[headerMap.owner];
      return { owner, ownerIndex };
    }

    ownerIndex = cells.findIndex((cell) => isUnassigned(cell) || isTargetOwner(cell, cfg.targetOwner));
    if (ownerIndex >= 0) return { owner: cells[ownerIndex], ownerIndex };

    ownerIndex = cells.findIndex((cell) => looksLikeOwner(cell, cfg.targetOwner));
    if (ownerIndex >= 0) return { owner: cells[ownerIndex], ownerIndex };

    return { owner: '', ownerIndex: -1 };
  }

  function extractRows(cfg) {
    const rows = [];
    const seen = new Set();
    const rowHeaderMaps = new Map();
    const containers = [...document.querySelectorAll('[role="grid"], [role="treegrid"], table')];

    for (const container of containers) {
      const headerMap = getHeaderMap(container);
      if (!isIncidentHeaderMap(headerMap)) continue;
      for (const row of container.querySelectorAll('[role="row"], tr')) {
        if (!rowHeaderMaps.has(row)) rowHeaderMaps.set(row, headerMap);
      }
    }

    for (const [row, headerMap] of rowHeaderMaps.entries()) {
      const text = normalize(row.innerText || row.textContent || '');
      if (!text || text.length < 5) continue;
      if (/Severity\s+Title\s+Owner/i.test(text)) continue;
      if (/^Severity\b/i.test(text) && /\bOwner\b/i.test(text) && /\bStatus\b/i.test(text)) continue;

      const cells = getCellTexts(row);
      if (cells.length >= 2 && cells.some((cell) => /^severity$/i.test(cell)) && cells.some((cell) => /^owner$/i.test(cell))) continue;

      let owner = '';
      let ownerIndex = -1;
      let severity = 'Unknown';
      let title = '';
      let status = '';
      let created = '';
      const href = extractLink(row, headerMap);

      if (cells.length >= 2) {
        const ownerResult = findOwner(cells, cfg, headerMap);
        owner = ownerResult.owner;
        ownerIndex = ownerResult.ownerIndex;
        if (!owner) continue;

        severity = Number.isInteger(headerMap.severity) && cells[headerMap.severity]
          ? normalizeSeverity(cells[headerMap.severity]) || findSeverity(cells, text)
          : findSeverity(cells, text);
        status = Number.isInteger(headerMap.status) && cells[headerMap.status]
          ? cells[headerMap.status]
          : findStatus(cells);
        created = Number.isInteger(headerMap.created) && cells[headerMap.created]
          ? cells[headerMap.created]
          : findCreated(cells);
        title = findTitle(cells, ownerIndex, severity, cfg.targetOwner, text, headerMap);
      } else {
        const targetNormalized = ownerKey(cfg.targetOwner);
        const words = text.match(/\b(Unassigned|SOC[\s_-]*Tier[\s_-]*\d+)\b/i);
        if (words && (isUnassigned(words[1]) || ownerKey(words[1]) === targetNormalized || looksLikeOwner(words[1], cfg.targetOwner))) {
          owner = words[1];
        }
        if (!owner && text.toLowerCase().includes(normalize(cfg.targetOwner).toLowerCase())) {
          owner = cfg.targetOwner;
        }
        if (!owner) continue;

        severity = findSeverity([], text);
        status = '';
        created = '';
        title = text.replace(owner, '').slice(0, 120);
      }

      const ariaIndex = row.getAttribute('aria-rowindex') || '';
      const rowKey = row.getAttribute('data-row-key') ||
        row.getAttribute('data-item-key') ||
        row.getAttribute('data-selection-key') ||
        row.getAttribute('data-automation-key') || '';
      const id = href ||
        rowKey ||
        makeStableId([title, created]) ||
        makeStableId([title, ariaIndex]) ||
        text.slice(0, 300);

      if (!id || seen.has(id)) continue;
      seen.add(id);
      rows.push({ id, title, owner, severity, status, created, href, text });
    }

    return rows;
  }

  function severityAllowed(severity, cfg) {
    if (cfg.severityFilterEnabled !== true) return true;
    const normalized = SEVERITIES.includes(severity) ? severity : 'Unknown';
    const filter = cfg.severityFilter || DEFAULTS.severityFilter;
    return filter[normalized] !== false;
  }

  function parseTimeToMinutes(value, fallback) {
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return fallback;
    const hours = Math.max(0, Math.min(23, Number(match[1])));
    const minutes = Math.max(0, Math.min(59, Number(match[2])));
    return hours * 60 + minutes;
  }

  function scheduleState(cfg, now = new Date()) {
    if (cfg.scheduleEnabled !== true) {
      return { allowed: true, reason: 'schedule disabled' };
    }

    const selectedDays = Array.isArray(cfg.scheduleDays) ? cfg.scheduleDays.map(Number) : [];
    if (!selectedDays.length) {
      return { allowed: false, reason: 'no selected days' };
    }

    const start = parseTimeToMinutes(cfg.scheduleStart, 8 * 60);
    const end = parseTimeToMinutes(cfg.scheduleEnd, 18 * 60);
    const minutes = now.getHours() * 60 + now.getMinutes();
    const day = now.getDay();
    const yesterday = (day + 6) % 7;

    if (start === end) {
      const allowed = selectedDays.includes(day);
      return { allowed, reason: allowed ? 'all day schedule' : 'outside selected days' };
    }

    if (start < end) {
      const allowed = selectedDays.includes(day) && minutes >= start && minutes <= end;
      return { allowed, reason: allowed ? 'inside working hours' : 'outside working hours' };
    }

    const allowed = (selectedDays.includes(day) && minutes >= start) ||
      (selectedDays.includes(yesterday) && minutes <= end);
    return { allowed, reason: allowed ? 'inside overnight schedule' : 'outside working hours' };
  }

  async function playSound(volume, customSoundDataUrl) {
    if (Number(volume) <= 0) return;
    const vol = Math.max(0, Math.min(1, Number(volume) || DEFAULTS.volume));
    try {
      const src = customSoundDataUrl || chrome.runtime.getURL('alert.mp3');
      const audio = new Audio(src);
      audio.volume = vol;
      await audio.play();
    } catch (e) {
      try {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContextCtor();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.value = 0.18 * vol;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        setTimeout(() => {
          try { osc.stop(); } catch (stopError) {}
          ctx.close().catch(() => {});
        }, 650);
      } catch (err) {
        console.warn(LOG_PREFIX, 'Sound blocked:', err);
        await setStatus({ lastError: 'Sound was blocked by browser. Click the Sentinel page or use Test sound.' });
      }
    }
  }

  function truncate(value, max = 120) {
    const text = normalize(value);
    return text.length > max ? `${text.slice(0, max - 1)}...` : text;
  }

  function classifyRow(row, cfg, schedule) {
    const targetMatched = isTargetOwner(row.owner, cfg.targetOwner);
    const sevAllowed = severityAllowed(row.severity || 'Unknown', cfg);
    const eligible = targetMatched && sevAllowed && schedule.allowed;
    let state = 'waiting';
    let reason = 'owner is not target';

    if (targetMatched && !sevAllowed) {
      state = 'blocked';
      reason = 'blocked by severity filter';
    } else if (targetMatched && sevAllowed && !schedule.allowed) {
      state = 'blocked';
      reason = `blocked by schedule: ${schedule.reason}`;
    } else if (eligible) {
      state = 'eligible';
      reason = 'will notify when transition/repeat rule matches';
    } else if (!targetMatched && isUnassigned(row.owner)) {
      state = 'waiting';
      reason = 'unassigned - waiting for target owner';
    }

    return { targetMatched, severityAllowed: sevAllowed, eligible, state, reason };
  }

  function compactRow(row, cfg, schedule, visible) {
    const cls = classifyRow(row, cfg, schedule);
    return {
      title: truncate(row.title || 'Incident', 90),
      owner: truncate(row.owner || '-', 50),
      severity: row.severity || 'Unknown',
      status: row.status || '',
      created: truncate(row.created || '', 40),
      visible: visible !== false,
      targetMatched: cls.targetMatched,
      severityAllowed: cls.severityAllowed,
      eligible: cls.eligible,
      state: cls.state,
      reason: cls.reason,
      lastSeen: row.lastSeenText || '',
      firstSeen: row.firstSeenText || ''
    };
  }

  function buildStatusRows(cfg, schedule) {
    const all = [...knownRows.values()]
      .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));

    const visible = all
      .filter((row) => row.visible)
      .slice(0, RECENT_LIMIT)
      .map((row) => compactRow(row, cfg, schedule, true));

    const remembered = all
      .filter((row) => !row.visible)
      .slice(0, RECENT_LIMIT)
      .map((row) => compactRow(row, cfg, schedule, false));

    return { visible, remembered };
  }

  async function alertFor(row, cfg, previous, reason) {
    const previousOwner = previous && previous.owner ? previous.owner : 'Unassigned';
    const title = truncate(row.title || 'Incident');
    const text = `${title}: ${previousOwner} -> ${row.owner}`;

    await playSound(cfg.volume, cfg.customSoundDataUrl);
    await setStatus({
      lastAlert: `${new Date().toLocaleTimeString()} ${text}`,
      lastIncident: title,
      lastOwner: row.owner,
      lastSeverity: row.severity,
      lastError: ''
    });

    chrome.runtime.sendMessage({
      type: 'SENTINEL_OWNER_ALERT',
      title,
      text,
      severity: row.severity,
      owner: row.owner,
      reason,
      href: row.href || location.href
    }).catch(() => {});

    console.log(LOG_PREFIX, 'ALERT', { row, previous, reason });
  }

  function pruneKnownRows(now) {
    const entries = [...knownRows.entries()]
      .sort((a, b) => ((b[1].lastSeen || 0) - (a[1].lastSeen || 0)));

    for (const [id, row] of entries) {
      if (!row.visible && now - (row.lastSeen || 0) > RECENT_TTL_MS) {
        knownRows.delete(id);
      }
    }

    const remaining = [...knownRows.entries()]
      .sort((a, b) => ((b[1].lastSeen || 0) - (a[1].lastSeen || 0)));
    if (remaining.length > RECENT_LIMIT * 2) {
      remaining.slice(RECENT_LIMIT * 2).forEach(([id]) => knownRows.delete(id));
    }
  }

  async function publishScanStatus(status) {
    await setStatus(status);
    chrome.runtime.sendMessage({
      type: 'SENTINEL_SCAN_STATUS',
      eligibleRows: status.eligibleRows || 0,
      targetRows: status.targetRows || 0,
      rows: status.rows || 0,
      enabled: status.enabled !== false,
      isSentinel: status.isSentinel === true,
      autoRefreshFound: status.autoRefreshFound === true,
      autoRefreshEnabled: status.autoRefreshEnabled,
      lastCheck: status.lastCheck || ''
    }).catch(() => {});
  }

  async function performScan(reason = 'auto') {
    const cfg = await getConfig();
    const schedule = scheduleState(cfg);
    const now = Date.now();
    const isSentinel = isAzureSentinelPage();
    const autoRefresh = await handleAutoRefreshState(cfg, isSentinel, reason);

    checks += 1;

    if (!cfg.enabled || !isSentinel) {
      const status = {
        loaded: true,
        enabled: cfg.enabled !== false,
        isSentinel,
        checks,
        rows: 0,
        visibleRows: [],
        rememberedRows: buildStatusRows(cfg, schedule).remembered,
        matchingRows: 0,
        targetRows: 0,
        nonTargetRows: 0,
        eligibleRows: 0,
        unassignedRows: 0,
        notVisibleRememberedRows: [...knownRows.values()].filter((row) => !row.visible).length,
        lastCheck: new Date().toLocaleString(),
        lastCheckTs: now,
        scanReason: reason,
        scheduleAllowed: schedule.allowed,
        scheduleReason: !cfg.enabled ? 'monitoring disabled' : (isSentinel ? schedule.reason : 'not a Sentinel page'),
        severityFilterEnabled: cfg.severityFilterEnabled === true,
        autoRefreshFound: autoRefresh.found === true,
        autoRefreshEnabled: autoRefresh.enabled,
        autoRefreshLabel: autoRefresh.label || '',
        autoRefreshAriaPressed: autoRefresh.ariaPressed || '',
        lastError: ''
      };
      await publishScanStatus(status);
      return;
    }

    const rows = extractRows(cfg);
    const currentIds = new Set(rows.map((row) => row.id));
    const target = ownerKey(cfg.targetOwner);
    let lastOwner = '';
    let lastSeverity = '';
    let targetRows = 0;
    let nonTargetRows = 0;
    let eligibleRows = 0;
    let unassignedRows = 0;
    let blockedBySeverityRows = 0;

    for (const [id, row] of knownRows.entries()) {
      if (!currentIds.has(id)) {
        knownRows.set(id, { ...row, visible: false });
      }
    }

    for (const row of rows) {
      const currentOwner = normalize(row.owner);
      const currentSeverity = row.severity || 'Unknown';
      lastOwner = currentOwner || lastOwner;
      lastSeverity = currentSeverity || lastSeverity;

      const previous = knownRows.get(row.id);
      const matchesTarget = ownerKey(currentOwner) === target;
      const allowedBySeverity = severityAllowed(currentSeverity, cfg);

      if (matchesTarget) targetRows += 1;
      else nonTargetRows += 1;
      if (isUnassigned(currentOwner)) unassignedRows += 1;
      if (matchesTarget && !allowedBySeverity) blockedBySeverityRows += 1;
      if (matchesTarget && allowedBySeverity && schedule.allowed) eligibleRows += 1;

      if (schedule.allowed && matchesTarget && allowedBySeverity) {
        const repeatWhilePresent = cfg.repeatWhilePresent === true;
        const changedFromUnassigned = previous !== undefined && isUnassigned(previous.owner);
        const changedToTarget = previous !== undefined && !isTargetOwner(previous.owner, cfg.targetOwner) && matchesTarget;
        const existingAllowed = previous === undefined && cfg.notifyOnExisting === true && reason !== 'initial';
        const becameAllowedBySeverity = previous !== undefined && previous.targetMatched === true && previous.severityAllowed === false;
        const repeatSeconds = Math.max(1, Number(cfg.repeatSoundSeconds || DEFAULTS.repeatSoundSeconds));
        const repeatDue = now - Number((previous && previous.lastAlertAt) || 0) >= repeatSeconds * 1000;
        let lastAlertAt = Number((previous && previous.lastAlertAt) || 0);

        let alertReason = '';
        if (changedFromUnassigned) alertReason = 'owner changed from Unassigned';
        else if (changedToTarget) alertReason = 'owner changed to target';
        else if (becameAllowedBySeverity) alertReason = 'severity filter matched';
        else if (existingAllowed) alertReason = 'existing matching row';
        else if (repeatWhilePresent && repeatDue) alertReason = 'repeat while present';

        if (alertReason) {
          await alertFor(row, cfg, previous, alertReason);
          lastAlertAt = Date.now();
        }

        row.lastAlertAt = lastAlertAt;
      }

      knownRows.set(row.id, {
        id: row.id,
        title: row.title,
        owner: currentOwner,
        severity: currentSeverity,
        status: row.status,
        created: row.created,
        href: row.href,
        severityAllowed: allowedBySeverity,
        targetMatched: matchesTarget,
        firstSeen: previous && previous.firstSeen ? previous.firstSeen : now,
        firstSeenText: previous && previous.firstSeenText ? previous.firstSeenText : new Date(now).toLocaleTimeString(),
        lastSeen: now,
        lastSeenText: new Date(now).toLocaleTimeString(),
        visible: true,
        previousOwner: previous && previous.owner ? previous.owner : '',
        lastAlertAt: Number(row.lastAlertAt || (previous && previous.lastAlertAt) || 0)
      });
    }

    pruneKnownRows(now);

    const statusRows = buildStatusRows(cfg, schedule);
    const notVisibleRememberedRows = [...knownRows.values()].filter((row) => !row.visible).length;
    const signature = `${autoRefresh.found}:${autoRefresh.enabled}|` + rows.map((r) => `${r.id}:${r.owner}:${r.severity}`).join('|');

    if (signature !== lastSignature || checks % 3 === 0 || reason === 'force' || reason === 'initial') {
      lastSignature = signature;
      await publishScanStatus({
        loaded: true,
        enabled: true,
        isSentinel: true,
        checks,
        rows: rows.length,
        matchingRows: targetRows,
        targetRows,
        nonTargetRows,
        eligibleRows,
        unassignedRows,
        blockedBySeverityRows,
        notVisibleRememberedRows,
        lastCheck: new Date().toLocaleString(),
        lastCheckTs: now,
        scanReason: reason,
        scheduleAllowed: schedule.allowed,
        scheduleReason: schedule.reason,
        severityFilterEnabled: cfg.severityFilterEnabled === true,
        severityFilterState: cfg.severityFilterEnabled === true ? 'enabled' : 'disabled',
        autoRefreshFound: autoRefresh.found === true,
        autoRefreshEnabled: autoRefresh.enabled,
        autoRefreshLabel: autoRefresh.label || '',
        autoRefreshAriaPressed: autoRefresh.ariaPressed || '',
        lastOwner,
        lastSeverity,
        lastError: '',
        visibleRows: statusRows.visible,
        rememberedRows: statusRows.remembered,
        debug: `reason=${reason}; rows=${rows.length}; target=${targetRows}; eligible=${eligibleRows}; visible=${statusRows.visible.length}; remembered=${statusRows.remembered.length}`
      });
    }
  }

  function queueScanReason(currentReason, nextReason) {
    const priority = {
      auto: 1,
      mutation: 2,
      visibility: 3,
      focus: 3,
      initial: 4,
      'enable-auto-refresh': 5,
      force: 6
    };
    return (priority[nextReason] || 1) >= (priority[currentReason] || 0) ? nextReason : currentReason;
  }

  function scan(reason = 'auto') {
    if (activeScanPromise) {
      pendingScanReason = queueScanReason(pendingScanReason, reason);
      return activeScanPromise;
    }

    activeScanPromise = (async () => {
      let nextReason = reason;
      while (nextReason) {
        pendingScanReason = '';
        await performScan(nextReason);
        nextReason = pendingScanReason;
      }
    })().finally(() => {
      activeScanPromise = null;
    });

    return activeScanPromise;
  }

  function scheduleMutationScan() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => scan('mutation'), 200);
  }

  function start() {
    if (timer) clearInterval(timer);
    getConfig().then((cfg) => {
      const ms = Math.max(1000, Number(cfg.intervalSeconds || DEFAULTS.intervalSeconds) * 1000);
      scan('initial');
      timer = setInterval(() => scan('auto'), ms);
    }).catch((error) => {
      console.warn(LOG_PREFIX, 'Unable to start monitor:', error);
      setStatus({ lastError: String(error && error.message ? error.message : error) });
    });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
      if (message.type === 'FORCE_SCAN') await scan('force');
      if (message.type === 'TEST_SOUND') {
        const cfg = await getConfig();
        await playSound(message.volume !== undefined ? message.volume : cfg.volume, cfg.customSoundDataUrl);
      }
      if (message.type === 'RESTART_MONITOR') start();
      if (message.type === 'ENABLE_AUTO_REFRESH') {
        const state = await enableAutoRefresh();
        await scan('enable-auto-refresh');
        sendResponse({ ok: true, state });
        return;
      }
      if (message.type === 'GET_SCAN_STATUS') {
        const old = await chrome.storage.local.get({ lastStatus: {} });
        sendResponse({ ok: true, status: old.lastStatus || {} });
        return;
      }
      sendResponse({ ok: true });
    })().catch((error) => {
      console.warn(LOG_PREFIX, 'message error:', error);
      sendResponse({ ok: false, error: String(error && error.message ? error.message : error) });
    });
    return true;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const watched = [
      'enabled', 'intervalSeconds', 'targetOwner', 'severityFilterEnabled', 'severityFilter',
      'severityLevels', 'includeUnknownSeverity', 'scheduleEnabled', 'scheduleStart', 'scheduleEnd', 'scheduleDays',
      'autoRefreshBannerEnabled', 'autoRefreshSoundEnabled', 'autoRefreshSoundSeconds', 'autoRefreshAutoEnable'
    ];
    if (watched.some((key) => Object.prototype.hasOwnProperty.call(changes, key))) {
      start();
    }
  });

  const observer = new MutationObserver(scheduleMutationScan);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true });
  window.addEventListener('focus', () => scan('focus'));
  document.addEventListener('visibilitychange', () => scan('visibility'));

  start();
  setStatus({ loaded: true, lastCheck: new Date().toLocaleString(), lastCheckTs: Date.now(), lastError: '' });
  console.log(LOG_PREFIX, 'loaded v3.2.3');
})();
