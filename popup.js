const $ = (id) => document.getElementById(id);

const DEFAULTS = {
  enabled: true,
  volume: 0.8,
  intervalSeconds: 2,
  targetOwner: 'SOC_Tier_1',
  notifyOnExisting: false,
  repeatWhilePresent: false,
  repeatSoundSeconds: 10,
  customSoundDataUrl: '',
  customSoundName: '',
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
  autoRefreshAutoEnable: false,
  lastStatus: {}
};

let lastStatusCache = {};
let lastConfigCache = { ...DEFAULTS };

function mergeConfig(input) {
  const raw = input || {};
  const cfg = { ...DEFAULTS, ...raw };
  cfg.severityFilter = { ...DEFAULTS.severityFilter, ...(raw.severityFilter || {}) };

  // Migration support for older experimental keys.
  if (raw.severityLevels && typeof raw.severityLevels === 'object') {
    cfg.severityFilter = {
      Critical: raw.severityLevels.critical !== false,
      High: raw.severityLevels.high !== false,
      Medium: raw.severityLevels.medium !== false,
      Low: raw.severityLevels.low !== false,
      Informational: raw.severityLevels.informational !== false,
      Unknown: raw.includeUnknownSeverity !== false
    };
  }

  if (Array.isArray(raw.scheduleDays)) {
    cfg.scheduleDays = raw.scheduleDays.map(Number).filter((day) => day >= 0 && day <= 6);
  } else if (raw.scheduleDays && typeof raw.scheduleDays === 'object') {
    cfg.scheduleDays = Object.entries(raw.scheduleDays)
      .filter((entry) => entry[1] !== false)
      .map((entry) => Number(entry[0]))
      .filter((day) => day >= 0 && day <= 6);
  } else {
    cfg.scheduleDays = DEFAULTS.scheduleDays.slice();
  }

  cfg.severityFilterEnabled = raw.severityFilterEnabled === true;
  return cfg;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function activeTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function sendToActive(message) {
  const tab = await activeTab();
  if (!tab || !tab.id) return { ok: false, error: 'No active tab.' };
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

function updateLabels() {
  $('intervalLabel').textContent = $('intervalSeconds').value;
  $('volumeLabel').textContent = $('volume').value;
  $('repeatLabel').textContent = $('repeatSoundSeconds').value;
  $('autoRefreshSoundLabel').textContent = $('autoRefreshSoundSeconds').value;
}

function setSeverityOptionsEnabled(enabled) {
  ['sevCritical', 'sevHigh', 'sevMedium', 'sevLow', 'sevInformational', 'includeUnknownSeverity'].forEach((id) => {
    $(id).disabled = !enabled;
  });
  $('severityOptions').style.opacity = enabled ? '1' : '0.55';
}

function setScheduleOptionsEnabled(enabled) {
  ['scheduleStart', 'scheduleEnd', 'day0', 'day1', 'day2', 'day3', 'day4', 'day5', 'day6'].forEach((id) => {
    $(id).disabled = !enabled;
  });
  $('scheduleDays').style.opacity = enabled ? '1' : '0.55';
}


function renderAutoRefreshStatus(status) {
  const s = status || {};
  const pill = $('autoRefreshPill');
  const text = $('autoRefreshText');
  if (!pill || !text) return;

  pill.className = 'refPill unknown';
  if (s.isSentinel === false) {
    pill.textContent = '-';
    text.textContent = 'Nejsi na Sentinel Incidents strance.';
    return;
  }

  if (s.autoRefreshFound !== true) {
    pill.textContent = '?';
    text.textContent = 'Toggle Auto-refresh incidents nebyl nalezen.';
    return;
  }

  if (s.autoRefreshEnabled === true) {
    pill.className = 'refPill on';
    pill.textContent = 'ON';
    text.textContent = 'Auto-refresh je zapnuty.';
    return;
  }

  if (s.autoRefreshEnabled === false) {
    pill.className = 'refPill off';
    pill.textContent = 'OFF';
    text.textContent = 'Auto-refresh je vypnuty - nove incidenty se nemusi nacitat automaticky.';
    return;
  }

  pill.textContent = '?';
  text.textContent = 'Auto-refresh toggle nalezen, ale stav neni jednoznacny.';
}

function formatAge(ts) {
  if (!ts) return '-';
  const age = Math.max(0, Date.now() - Number(ts));
  if (age < 1000) return 'ted';
  const sec = Math.floor(age / 1000);
  if (sec < 60) return `${sec} s ago`;
  const min = Math.floor(sec / 60);
  return `${min} min ago`;
}

function renderScanIndicator(status) {
  const s = status || {};
  const dot = $('scanDot');
  const state = $('scanStateText');
  const age = $('scanAge');
  const reason = $('scanReason');
  const interval = Math.max(1, Number(lastConfigCache.intervalSeconds || DEFAULTS.intervalSeconds));
  const staleMs = Math.max(10000, interval * 3500 + 5000);
  const lastTs = Number(s.lastCheckTs || 0);
  const isStale = lastTs ? (Date.now() - lastTs > staleMs) : true;

  dot.className = 'dot';
  if (!s.loaded) {
    dot.classList.add('bad');
    state.textContent = 'Scanner not loaded';
  } else if (s.enabled === false) {
    dot.classList.add('warn');
    state.textContent = 'Monitoring off';
  } else if (s.isSentinel === false) {
    dot.classList.add('warn');
    state.textContent = 'Not on Sentinel page';
  } else if (isStale) {
    dot.classList.add('warn');
    state.textContent = 'Scanner stale';
  } else if (s.autoRefreshFound === true && s.autoRefreshEnabled === false) {
    dot.classList.add('bad');
    state.textContent = 'Scanner online, auto-refresh OFF';
  } else {
    dot.classList.add('ok');
    state.textContent = 'Scanner online';
  }

  age.textContent = `Last scan: ${formatAge(lastTs)}`;
  const autoRefreshState = s.autoRefreshFound === true ? (s.autoRefreshEnabled === true ? 'ON' : (s.autoRefreshEnabled === false ? 'OFF' : 'unknown')) : 'not found';
  reason.textContent = `Reason: ${s.scanReason || '-'} | Schedule: ${s.scheduleAllowed === false ? 'blocked' : 'allowed'} (${s.scheduleReason || '-'}) | Severity filter: ${s.severityFilterEnabled ? 'on' : 'off'} | Auto-refresh: ${autoRefreshState}`;
  renderAutoRefreshStatus(s);

  $('cntVisible').textContent = s.rows || 0;
  $('cntTarget').textContent = s.targetRows || s.matchingRows || 0;
  $('cntEligible').textContent = s.eligibleRows || 0;
}

function rowStateClass(row) {
  if (row.eligible) return 'ok';
  if (row.state === 'blocked') return 'block';
  return 'wait';
}

function renderIncidentList(elementId, rows, emptyText) {
  const list = $(elementId);
  const data = Array.isArray(rows) ? rows : [];
  if (!data.length) {
    list.innerHTML = `<div class="empty">${escapeHtml(emptyText)}</div>`;
    return;
  }

  list.innerHTML = data.map((row) => {
    const tagClass = rowStateClass(row);
    const stateText = row.eligible ? 'eligible' : (row.state || 'waiting');
    const visibleText = row.visible === false ? 'not visible' : 'visible';
    return `
      <div class="incidentItem">
        <div class="incidentTitle">${escapeHtml(row.title || 'Incident')}</div>
        <div class="incidentMeta">
          <span class="tag ${tagClass}">${escapeHtml(stateText)}</span>
          <span class="tag">${escapeHtml(visibleText)}</span>
          <span class="tag">Owner: ${escapeHtml(row.owner || '-')}</span>
          <span class="tag">Severity: ${escapeHtml(row.severity || 'Unknown')}</span>
          ${row.status ? `<span class="tag">Status: ${escapeHtml(row.status)}</span>` : ''}
          <br>
          ${escapeHtml(row.reason || '')}
          ${row.lastSeen ? `<br>Last seen: ${escapeHtml(row.lastSeen)}` : ''}
        </div>
      </div>`;
  }).join('');
}

function renderStatus(status) {
  const s = status || {};
  lastStatusCache = s;
  renderScanIndicator(s);
  renderIncidentList('visibleRows', s.visibleRows || [], 'Zatim zadne viditelne incidenty.');
  renderIncidentList('rememberedRows', s.rememberedRows || [], 'Zatim zadne zapamatovane incidenty.');

  $('status').innerHTML = `
    <b>Content script:</b> ${s.loaded ? 'nacten' : 'nezjisten'}<br>
    <b>Monitoring:</b> ${s.enabled === false ? 'vypnuty' : 'zapnuty'}<br>
    <b>Sentinel page:</b> ${s.isSentinel === false ? 'ne' : 'ano'}<br>
    <b>Auto-refresh nalezen:</b> ${s.autoRefreshFound === true ? 'ano' : 'ne'}<br>
    <b>Auto-refresh stav:</b> ${s.autoRefreshFound === true ? (s.autoRefreshEnabled === true ? 'ON' : (s.autoRefreshEnabled === false ? 'OFF' : 'neznamy')) : '-'}<br>
    <b>Auto-refresh label:</b> ${escapeHtml(s.autoRefreshLabel || '-')}<br>
    <b>Posledni auto-refresh alert:</b> ${escapeHtml(s.lastAutoRefreshAlert || '-')}<br>
    <b>Kontroly:</b> ${escapeHtml(s.checks || 0)}<br>
    <b>Nalezenych radku:</b> ${escapeHtml(s.rows || 0)}<br>
    <b>Target owner radku:</b> ${escapeHtml(s.targetRows || s.matchingRows || 0)}<br>
    <b>Non-target radku:</b> ${escapeHtml(s.nonTargetRows || 0)}<br>
    <b>Eligible radku:</b> ${escapeHtml(s.eligibleRows || 0)}<br>
    <b>Unassigned radku:</b> ${escapeHtml(s.unassignedRows || 0)}<br>
    <b>Zapamatovane uz neviditelne:</b> ${escapeHtml(s.notVisibleRememberedRows || 0)}<br>
    <b>Posledni kontrola:</b> ${escapeHtml(s.lastCheck || '-')}<br>
    <b>Schedule:</b> ${escapeHtml(s.scheduleReason || '-')}<br>
    <b>Severity filter:</b> ${escapeHtml(s.severityFilterEnabled ? 'zapnuty' : 'vypnuty')}<br>
    <b>Posledni owner:</b> ${escapeHtml(s.lastOwner || '-')}<br>
    <b>Posledni incident:</b> ${escapeHtml(s.lastIncident || '-')}<br>
    <b>Posledni severity:</b> ${escapeHtml(s.lastSeverity || '-')}<br>
    <b>Posledni alert:</b> ${escapeHtml(s.lastAlert || '-')}<br>
    <b>Chyba:</b> ${escapeHtml(s.lastError || '-')}
  `;
}

function collectConfigFromUi() {
  const scheduleDays = [];
  ['0', '1', '2', '3', '4', '5', '6'].forEach((day) => {
    if ($(`day${day}`).checked) scheduleDays.push(Number(day));
  });

  return {
    enabled: $('enabled').checked,
    desktopNotifications: $('desktopNotifications').checked,
    notifyOnExisting: $('notifyOnExisting').checked,
    repeatWhilePresent: $('repeatWhilePresent').checked,
    repeatSoundSeconds: Number($('repeatSoundSeconds').value),
    targetOwner: $('targetOwner').value.trim() || 'SOC_Tier_1',
    intervalSeconds: Number($('intervalSeconds').value),
    volume: Number($('volume').value) / 100,
    autoRefreshBannerEnabled: $('autoRefreshBannerEnabled').checked,
    autoRefreshSoundEnabled: $('autoRefreshSoundEnabled').checked,
    autoRefreshSoundSeconds: Number($('autoRefreshSoundSeconds').value),
    autoRefreshAutoEnable: $('autoRefreshAutoEnable').checked,
    severityFilterEnabled: $('severityFilterEnabled').checked,
    severityFilter: {
      Critical: $('sevCritical').checked,
      High: $('sevHigh').checked,
      Medium: $('sevMedium').checked,
      Low: $('sevLow').checked,
      Informational: $('sevInformational').checked,
      Unknown: $('includeUnknownSeverity').checked
    },
    scheduleEnabled: $('scheduleEnabled').checked,
    scheduleStart: $('scheduleStart').value || '08:00',
    scheduleEnd: $('scheduleEnd').value || '18:00',
    scheduleDays
  };
}

async function save() {
  const cfg = collectConfigFromUi();
  lastConfigCache = mergeConfig({ ...lastConfigCache, ...cfg });
  await chrome.storage.local.set(cfg);
  updateLabels();
  setSeverityOptionsEnabled(cfg.severityFilterEnabled);
  setScheduleOptionsEnabled(cfg.scheduleEnabled);
  await sendToActive({ type: 'RESTART_MONITOR' });
}

async function load() {
  const stored = await chrome.storage.local.get({
    ...DEFAULTS,
    severityLevels: null,
    includeUnknownSeverity: true
  });
  const cfg = mergeConfig(stored);
  lastConfigCache = cfg;

  $('enabled').checked = cfg.enabled;
  $('desktopNotifications').checked = cfg.desktopNotifications;
  $('notifyOnExisting').checked = cfg.notifyOnExisting;
  $('repeatWhilePresent').checked = cfg.repeatWhilePresent;
  $('targetOwner').value = cfg.targetOwner;
  $('intervalSeconds').value = cfg.intervalSeconds;
  $('repeatSoundSeconds').value = cfg.repeatSoundSeconds;
  $('volume').value = Math.round((Number(cfg.volume) || 0) * 100);
  $('autoRefreshBannerEnabled').checked = cfg.autoRefreshBannerEnabled !== false;
  $('autoRefreshSoundEnabled').checked = cfg.autoRefreshSoundEnabled === true;
  $('autoRefreshSoundSeconds').value = cfg.autoRefreshSoundSeconds || DEFAULTS.autoRefreshSoundSeconds;
  $('autoRefreshAutoEnable').checked = cfg.autoRefreshAutoEnable === true;

  $('severityFilterEnabled').checked = cfg.severityFilterEnabled;
  $('sevCritical').checked = cfg.severityFilter.Critical !== false;
  $('sevHigh').checked = cfg.severityFilter.High !== false;
  $('sevMedium').checked = cfg.severityFilter.Medium !== false;
  $('sevLow').checked = cfg.severityFilter.Low !== false;
  $('sevInformational').checked = cfg.severityFilter.Informational !== false;
  $('includeUnknownSeverity').checked = cfg.severityFilter.Unknown !== false;

  $('scheduleEnabled').checked = cfg.scheduleEnabled;
  $('scheduleStart').value = cfg.scheduleStart || '08:00';
  $('scheduleEnd').value = cfg.scheduleEnd || '18:00';
  ['0', '1', '2', '3', '4', '5', '6'].forEach((day) => {
    $(`day${day}`).checked = cfg.scheduleDays.includes(Number(day));
  });

  $('soundStatus').textContent = cfg.customSoundName
    ? `Aktivni vlastni zvuk: ${cfg.customSoundName} (ulozeno natrvalo v rozsireni)`
    : 'Aktivni vychozi zvuk.';

  updateLabels();
  setSeverityOptionsEnabled(cfg.severityFilterEnabled);
  setScheduleOptionsEnabled(cfg.scheduleEnabled);
  renderStatus(cfg.lastStatus || {});

  // Ask the content script for the freshest status if popup opens on the Sentinel tab.
  const response = await sendToActive({ type: 'GET_SCAN_STATUS' });
  if (response && response.ok && response.status) {
    renderStatus(response.status);
  }
}

async function playTestSound() {
  const cfg = mergeConfig(await chrome.storage.local.get(DEFAULTS));
  if (Number(cfg.volume) <= 0) return;
  const src = cfg.customSoundDataUrl || chrome.runtime.getURL('alert.mp3');
  const audio = new Audio(src);
  audio.volume = Math.max(0, Math.min(1, Number(cfg.volume) || 0.8));
  try {
    await audio.play();
  } catch (e) {
    await sendToActive({ type: 'TEST_SOUND', volume: audio.volume });
  }
}

['enabled', 'desktopNotifications', 'notifyOnExisting', 'repeatWhilePresent', 'targetOwner', 'intervalSeconds', 'repeatSoundSeconds', 'volume', 'autoRefreshBannerEnabled', 'autoRefreshSoundEnabled', 'autoRefreshSoundSeconds', 'autoRefreshAutoEnable', 'severityFilterEnabled', 'sevCritical', 'sevHigh', 'sevMedium', 'sevLow', 'sevInformational', 'includeUnknownSeverity', 'scheduleEnabled', 'scheduleStart', 'scheduleEnd', 'day0', 'day1', 'day2', 'day3', 'day4', 'day5', 'day6'].forEach((id) => {
  $(id).addEventListener('input', save);
  $(id).addEventListener('change', save);
});

$('customSound').addEventListener('change', async () => {
  const file = $('customSound').files && $('customSound').files[0];
  if (!file) return;

  if (!file.type.startsWith('audio/')) {
    $('soundStatus').textContent = 'Vyber prosim audio soubor.';
    return;
  }

  if (file.size > 8 * 1024 * 1024) {
    $('soundStatus').textContent = 'Soubor je moc velky. Zkus zvuk do 8 MB.';
    return;
  }

  $('soundStatus').textContent = 'Ukladam zvuk...';
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      await chrome.storage.local.set({
        customSoundDataUrl: reader.result,
        customSoundName: file.name,
        customSoundSavedAt: new Date().toISOString()
      });
      $('soundStatus').textContent = `Aktivni vlastni zvuk: ${file.name} (ulozeno natrvalo v rozsireni)`;
      await sendToActive({ type: 'RESTART_MONITOR' });
    } catch (e) {
      $('soundStatus').textContent = 'Zvuk se nepodarilo ulozit. Zkus mensi soubor.';
    }
  };
  reader.onerror = () => {
    $('soundStatus').textContent = 'Zvuk se nepodarilo nacist.';
  };
  reader.readAsDataURL(file);
});

$('clearSound').addEventListener('click', async () => {
  await chrome.storage.local.set({ customSoundDataUrl: '', customSoundName: '', customSoundSavedAt: '' });
  $('customSound').value = '';
  $('soundStatus').textContent = 'Aktivni vychozi zvuk.';
  await sendToActive({ type: 'RESTART_MONITOR' });
});

$('testSound').addEventListener('click', async () => {
  await playTestSound();
});

$('forceScan').addEventListener('click', async () => {
  await sendToActive({ type: 'FORCE_SCAN' });
  setTimeout(load, 500);
});

$('enableAutoRefreshNow').addEventListener('click', async () => {
  const btn = $('enableAutoRefreshNow');
  btn.textContent = 'Zapinam auto-refresh...';
  const response = await sendToActive({ type: 'ENABLE_AUTO_REFRESH' });
  btn.textContent = 'Zapnout auto-refresh ted';
  if (!response || response.ok === false) {
    $('autoRefreshText').textContent = response && response.error ? response.error : 'Nepodarilo se kontaktovat content script.';
  }
  setTimeout(load, 500);
});

$('testDesktop').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'TEST_DESKTOP_NOTIFICATION' });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.lastStatus) {
    renderStatus(changes.lastStatus.newValue || {});
  }
  if (area === 'local' && (changes.customSoundName || changes.customSoundDataUrl)) {
    chrome.storage.local.get(DEFAULTS).then((stored) => {
      const cfg = mergeConfig(stored);
      $('soundStatus').textContent = cfg.customSoundName
        ? `Aktivni vlastni zvuk: ${cfg.customSoundName} (ulozeno natrvalo v rozsireni)`
        : 'Aktivni vychozi zvuk.';
    });
  }
});

setInterval(() => {
  renderScanIndicator(lastStatusCache || {});
}, 1000);

load();
