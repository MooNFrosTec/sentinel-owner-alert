(() => {
  function t(key, substitutions, fallback = '') {
    try {
      return chrome.i18n.getMessage(key, substitutions) || fallback || key;
    } catch (error) {
      return fallback || key;
    }
  }

  function localizeDocument(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((element) => {
      element.textContent = t(element.dataset.i18n, undefined, element.textContent);
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
      element.setAttribute('placeholder', t(element.dataset.i18nPlaceholder, undefined, element.getAttribute('placeholder') || ''));
    });
    document.documentElement.lang = chrome.i18n.getUILanguage().split('-')[0] || 'en';
  }

  globalThis.SentinelOwnerAlertI18n = { t, localizeDocument };
})();
