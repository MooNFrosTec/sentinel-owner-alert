# Sentinel Owner Alert

**Current version: 3.4.0**

Sentinel Owner Alert is a lightweight Chromium extension that monitors incident rows currently visible on the Microsoft Sentinel **Incidents** page. It can notify you when an incident matches your configured owner, severity, and working-hours rules.

## Highlights

- Monitors incidents assigned to a selected owner.
- Filters alerts by severity, working hours, and selected days.
- Provides local sound alerts and desktop notifications.
- Supports a bundled alert sound or a custom sound stored locally.
- Shows scanner health, visible-row counts, and recently seen incidents.
- Detects when Microsoft Sentinel auto-refresh is disabled.
- Can show a warning banner or enable auto-refresh from the page or popup.
- Available in English and Czech, selected from the browser language.

## What's new in 3.4.0

- Added complete English and Czech localization.
- Localized the popup, extension metadata, notifications, and the Azure Portal warning.
- English remains the default language; Czech is selected automatically for Czech browser UIs.

Version 3.4 also includes the recent scanner reliability improvements, a reproducible original alert sound, and preparation for Chrome Web Store distribution.

## Install or update

### New installation

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome or `brave://extensions` in Brave.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose the repository folder.
5. Open or refresh the Microsoft Sentinel Incidents page.

### Update an existing installation

Replace the files in the folder already loaded by the browser, then select **Reload** on the extensions page. This preserves the existing extension storage, including settings and an uploaded custom sound.

## How it works

The extension reads only incident rows already rendered in the Microsoft Sentinel page. It does not call Microsoft Sentinel APIs or send incident data to external services.

Because the Azure Portal uses virtualized tables, rows that are filtered out or not currently loaded into the page cannot be scanned until they become visible.

## Privacy

Processing and configuration storage stay in the browser. The extension contains no advertising, analytics, or tracking. See the [privacy policy](PRIVACY.md) for details.

## Build the release package

```bash
python3 tools/package_extension.py
```

The validated ZIP is created in `dist/` and is ready for upload to the Chrome Web Store Developer Dashboard.

## Support

Please report bugs or feature requests through [GitHub Issues](https://github.com/MooNFrosTec/sentinel-owner-alert/issues).
