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
  customSoundSize: 0,
  customSoundStoredAt: '',
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
  lastStatus: {
    loaded: false,
    enabled: true,
    isSentinel: false,
    checks: 0,
    rows: 0,
    targetRows: 0,
    nonTargetRows: 0,
    eligibleRows: 0,
    visibleRows: [],
    rememberedRows: [],
    lastCheck: null,
    lastCheckTs: 0,
    lastOwner: '',
    lastSeverity: '',
    lastAlert: '',
    lastIncident: '',
    lastError: '',
    scheduleAllowed: true,
    scheduleReason: '',
    autoRefreshFound: false,
    autoRefreshEnabled: null,
    autoRefreshLabel: '',
    autoRefreshLastAlert: ''
  }
};

async function ensureDefaults() {
  const current = await chrome.storage.local.get({
    ...DEFAULTS,
    severityLevels: null,
    includeUnknownSeverity: true
  });
  const toSet = {};

  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (current[key] === undefined) toSet[key] = value;
  }

  const severityFilter = { ...DEFAULTS.severityFilter, ...(current.severityFilter || {}) };
  if (current.severityLevels && typeof current.severityLevels === 'object') {
    toSet.severityFilter = {
      Critical: current.severityLevels.critical !== false,
      High: current.severityLevels.high !== false,
      Medium: current.severityLevels.medium !== false,
      Low: current.severityLevels.low !== false,
      Informational: current.severityLevels.informational !== false,
      Unknown: current.includeUnknownSeverity !== false
    };
  } else if (JSON.stringify(severityFilter) !== JSON.stringify(current.severityFilter || {})) {
    toSet.severityFilter = severityFilter;
  }

  if (current.scheduleDays && !Array.isArray(current.scheduleDays) && typeof current.scheduleDays === 'object') {
    toSet.scheduleDays = Object.entries(current.scheduleDays)
      .filter((entry) => entry[1] !== false)
      .map((entry) => Number(entry[0]))
      .filter((day) => day >= 0 && day <= 6);
  }

  if (Object.keys(toSet).length) await chrome.storage.local.set(toSet);
}

chrome.runtime.onInstalled.addListener(() => {
  ensureDefaults().catch(console.error);
});

chrome.runtime.onStartup.addListener(() => {
  ensureDefaults().catch(console.error);
});

const notificationTargets = new Map();

function buildNotificationMessage(message) {
  const lines = [];
  if (message.severity) lines.push(`Severity: ${message.severity}`);
  if (message.owner) lines.push(`Owner: ${message.owner}`);
  if (message.reason) lines.push(`Reason: ${message.reason}`);
  return lines.length ? lines.join('\n') : (message.text || 'Owner changed to target owner.');
}

async function updateBadge(sender, message) {
  if (!sender || !sender.tab || !sender.tab.id) return;

  let text = '';
  let color = '#777777';
  if (message.enabled === false) {
    text = 'OFF';
    color = '#777777';
  } else if (message.isSentinel === false) {
    text = '';
    color = '#777777';
  } else if (message.autoRefreshFound === true && message.autoRefreshEnabled === false) {
    text = 'REF';
    color = '#c62828';
  } else if (Number(message.eligibleRows || 0) > 0) {
    text = String(message.eligibleRows).slice(0, 4);
    color = '#2e7d32';
  } else {
    text = 'OK';
    color = '#1976d2';
  }

  await chrome.action.setBadgeText({ tabId: sender.tab.id, text });
  await chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color });
  await chrome.action.setTitle({
    tabId: sender.tab.id,
    title: `Sentinel Owner Alert - rows: ${message.rows || 0}, target: ${message.targetRows || 0}, eligible: ${message.eligibleRows || 0}, auto-refresh: ${message.autoRefreshFound ? (message.autoRefreshEnabled ? 'ON' : 'OFF') : 'unknown'}`
  });
}

function createNotification(message, sender) {
  const tabId = sender && sender.tab ? sender.tab.id : null;
  const windowId = sender && sender.tab ? sender.tab.windowId : null;
  const notificationId = `sentinel-owner-alert-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: 'icon128.png',
    title: message.title ? `Sentinel: ${message.title}` : 'Sentinel incident assigned',
    message: buildNotificationMessage(message),
    priority: message.severity === 'High' || message.severity === 'Critical' ? 2 : 1
  });

  notificationTargets.set(notificationId, {
    tabId,
    windowId,
    url: sender && sender.tab ? sender.tab.url : ''
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    await ensureDefaults();

    if (message && message.type === 'SENTINEL_OWNER_ALERT') {
      const cfg = await chrome.storage.local.get({ desktopNotifications: true });
      if (cfg.desktopNotifications !== false) {
        createNotification(message, sender);
      }
    }

    if (message && message.type === 'SENTINEL_SCAN_STATUS') {
      await updateBadge(sender, message);
    }

    if (message && message.type === 'TEST_DESKTOP_NOTIFICATION') {
      createNotification({
        title: 'Test notification',
        severity: 'Test',
        owner: 'SOC_Tier_1',
        reason: 'manual test from extension popup'
      }, sender);
    }

    sendResponse({ ok: true });
  })().catch((error) => {
    console.error('[Sentinel Owner Alert] background error:', error);
    sendResponse({ ok: false, error: String(error && error.message ? error.message : error) });
  });
  return true;
});

chrome.notifications.onClicked.addListener((notificationId) => {
  const target = notificationTargets.get(notificationId);
  chrome.notifications.clear(notificationId);
  if (!target || !target.tabId) return;

  chrome.tabs.update(target.tabId, { active: true }).catch(() => {});
  if (target.windowId) {
    chrome.windows.update(target.windowId, { focused: true }).catch(() => {});
  }
});

chrome.notifications.onClosed.addListener((notificationId) => {
  notificationTargets.delete(notificationId);
});
