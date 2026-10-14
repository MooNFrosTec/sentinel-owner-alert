Sentinel Owner Alert v3.6.1

Update/install:
1. Unzip this package.
2. In Brave open brave://extensions.
3. Enable Developer mode.
4. Recommended update path: replace files in the already loaded extension folder, then click Reload.
   This keeps the same extension storage and preserves uploaded custom sounds.
5. New install path: click Load unpacked and select the extracted folder.
   This creates a new extension instance, so settings and custom sound start from defaults.
6. Refresh the Microsoft Sentinel Incidents page after reloading the extension.

New in v3.6.1:
- Fixes SOC Focus owner matching when Azure and the configured owner use different Unicode representations of diacritics (for example `Szűcs`).

Existing v3.6.0 features:
- Adds SOC Focus mode for keeping the SOC queue and the current analyst's assigned incidents visible in one Sentinel tab.
- Highlights the configured queue owner in amber and the analyst owner in blue.
- Can show Queue + Mine, Queue only, Mine only, or all incidents, while hiding or dimming unrelated owners locally.
- Alerts continue to target only the configured queue owner; Focus mode does not change Sentinel data or call Sentinel APIs.

Existing v3.5.0 features:
- Detects native High incidents carrying the custom `Severity:Critical` tag.
- Classifies tagged High incidents as `Critical` inside the extension, including severity filtering and notifications.
- Replaces the visible High label with a red `Critical` label and highlights the full row in Microsoft Sentinel; Sentinel's underlying stored severity remains High.

Existing v3.4.0 features:
- Added complete English and Czech localization using Chrome's built-in language system.
- English is the default; Czech is selected automatically when the browser UI uses Czech.
- Localized the popup, Azure Portal auto-refresh warning, extension metadata and desktop notifications.

Existing v3.3.0 features:
- Prepared for Chrome Web Store submission with minimum permissions, complete icon metadata and a reproducible release package.
- Custom sound uploads are limited to 5 MB so the extension stays within the standard local storage quota.
- Added a privacy policy and Chrome Web Store listing/review guidance.

Existing v3.2.5 features:
- Replaces the third-party MP3 with an original, reproducibly generated triple-bell WAV sound.
- The bundled sound can be regenerated with tools/generate_alert.py.

Existing v3.2.4 fix:
- Stops the old page scanner quietly when an extension reload invalidates its Chrome API context.

Existing v3.2.3 fixes:
- Scans only grids with Severity, Title and Owner columns, preventing detail-panel rows such as Logic app from appearing as incidents.
- Prefers the incident title link instead of unrelated links from another cell.

Existing v3.2.2 features:
- Uses the triple-bell MP3 as the bundled default alert sound.

Existing v3.2.1 improvements:
- More reliable Auto-refresh ON/OFF detection.
- Serialized scans prevent overlapping checks and duplicate alerts.
- Repeat alerts are tracked independently for each incident.
- More stable incident identification and table header detection.
- Notification clicks survive service worker suspension and can open the incident.

Existing v3.2 features:
- Detects the Microsoft Sentinel Auto-refresh incidents toggle.
- Popup indicator shows Auto-refresh ON / OFF / not found.
- Browser action badge shows REF when Auto-refresh incidents is OFF.
- Optional sound warning when Auto-refresh incidents is OFF.
- Configurable repeat interval for the Auto-refresh OFF warning.
- Optional red warning banner directly on the Azure Portal page.
- Button in popup and page banner to enable Auto-refresh incidents.
- Optional auto-enable mode: the extension can click the Auto-refresh incidents toggle when it is OFF.

Important notes about auto-refresh:
- The extension detects the toggle from the page DOM, primarily aria-label="Auto-refresh incidents" and aria-pressed="true/false".
- Auto-enable does not call Azure APIs. It only clicks the same toggle button that the user would click manually.
- If Microsoft changes Azure Portal markup, the selector may need to be updated.

Existing v3.1 features:
- Live scan indicator in the popup: online/stale/off/not Sentinel.
- Scan counters: visible rows, target owner rows and eligible rows.
- Visible incident preview: shows rows the extension currently sees, including incidents not assigned to the target owner yet.
- Remembered incident preview: shows recently seen incidents that are no longer visible in the currently loaded list.
- Browser action badge: OK when scanning, number when eligible rows are present.

Existing v3.0 features:
- Severity filter: Critical, High, Medium, Low, Informational and Unknown.
- Working hours schedule: start/end time and selected days.
- Desktop notifications with title, severity and owner.
- Custom sound is stored in chrome.storage.local as a data URL, so it survives browser/PC restart.

Note:
The extension can only inspect rows that Azure Portal has loaded into the page DOM. If Sentinel filtering or virtualization hides rows, they cannot be scanned until they are visible/loaded in the page.
Custom sound survives restart as long as the extension is not removed and extension data is not cleared.

Chrome Web Store release:
1. Run: python3 tools/package_extension.py
2. Upload the generated dist/sentinel-owner-alert-VERSION.zip to the Chrome Web Store Developer Dashboard.
3. Copy the reviewed listing and privacy answers from STORE_LISTING.md.
4. Publish PRIVACY.md at the public URL entered in the dashboard.
5. Upload at least one sanitized 1280x800 or 640x400 screenshot that contains no real incident, tenant, user, subscription or workspace data.
