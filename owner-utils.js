(() => {
  function key(value) {
    return String(value || '')
      .normalize('NFKD')
      .replace(/[\p{M}\p{Cf}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '');
  }

  function matches(value, configuredOwner) {
    const configuredKey = key(configuredOwner);
    return configuredKey !== '' && key(value) === configuredKey;
  }

  globalThis.SentinelOwnerAlertOwner = { key, matches };
})();
