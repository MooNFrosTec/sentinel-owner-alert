(() => {
  const CUSTOM_CRITICAL_TAG_PATTERN = /\bSeverity\s*:\s*Critical\b/ig;

  function hasCustomCriticalTag(value) {
    CUSTOM_CRITICAL_TAG_PATTERN.lastIndex = 0;
    return CUSTOM_CRITICAL_TAG_PATTERN.test(String(value || ''));
  }

  function stripCustomCriticalTag(value) {
    CUSTOM_CRITICAL_TAG_PATTERN.lastIndex = 0;
    return String(value || '').replace(CUSTOM_CRITICAL_TAG_PATTERN, ' ');
  }

  function isCustomCritical(nativeSeverity, rowText) {
    return String(nativeSeverity || '').toLowerCase() === 'high' && hasCustomCriticalTag(rowText);
  }

  globalThis.SentinelOwnerAlertSeverity = {
    hasCustomCriticalTag,
    stripCustomCriticalTag,
    isCustomCritical
  };
})();
