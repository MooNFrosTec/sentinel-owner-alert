Sentinel Owner Alert v3.2.2

Update/install:
1. Unzip this package.
2. In Brave open brave://extensions.
3. Enable Developer mode.
4. Recommended update path: replace files in the already loaded extension folder, then click Reload.
   This keeps the same extension storage and preserves uploaded custom sounds.
5. New install path: click Load unpacked and select the extracted folder.
   This creates a new extension instance, so settings and custom sound start from defaults.
6. Refresh the Microsoft Sentinel Incidents page after reloading the extension.

New in v3.2.2:
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
