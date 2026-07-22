# Privacy Policy for Sentinel Owner Alert

Last updated: July 22, 2026

Sentinel Owner Alert is a browser extension that monitors the Microsoft Sentinel Incidents page opened by the user and provides local sound and desktop notifications when visible incidents match user-configured rules.

## Data processed

The extension processes only the information needed for its user-facing monitoring function:

- visible Microsoft Sentinel incident information, which may include incident title, owner, severity, status, timestamps, and incident links;
- the visible state of the Microsoft Sentinel auto-refresh control;
- settings selected by the user, such as target owner, severity filters, working hours, volume, and notification preferences;
- an optional custom alert sound selected by the user.

Depending on the content of the user's Microsoft Sentinel workspace, incident titles or owner fields may contain personally identifiable or organization-sensitive information.

## How data is used

All data is processed locally in the user's browser solely to:

- identify visible incidents that match the configured monitoring rules;
- play alert sounds and display desktop notifications;
- display scanner status and recently observed incident information in the extension popup;
- warn when the visible Microsoft Sentinel auto-refresh control is disabled.

The extension does not use data for advertising, profiling, analytics, creditworthiness, or any purpose unrelated to its single monitoring function.

## Storage and retention

Settings, the optional custom sound, and recent scanner status are stored locally using `chrome.storage.local`. Recent status is overwritten as monitoring continues. The custom sound remains stored until the user removes it, clears the extension's data, or uninstalls the extension.

Notification navigation targets are temporarily stored in `chrome.storage.session` and are cleared when the browser session ends, the extension is updated or reloaded, or the entry is no longer needed.

## Data sharing and transmission

The extension does not transmit Microsoft Sentinel content, settings, custom sounds, browsing activity, or personal information to the developer or to any third party. It has no analytics, advertising, tracking, telemetry, account system, or external backend service.

## Permissions

- `storage`: stores user settings, an optional custom sound, recent local scanner status, and temporary notification targets.
- `notifications`: displays desktop notifications requested by the extension's monitoring function.
- `https://portal.azure.com/*`: allows the extension to read the visible Microsoft Sentinel Incidents interface and the visible auto-refresh state. The extension does not access other website origins.

## User control

Users can disable monitoring or desktop notifications, remove a custom sound, clear extension data through the browser, or uninstall the extension at any time. Uninstalling the extension removes data stored in `chrome.storage.local`.

## Limited use

The extension's use of information is limited to providing and improving the single user-facing purpose described above. Data is not sold, transferred, or used for personalized advertising, and is not made available for human review by the developer.

## Changes to this policy

Material changes to data handling will be reflected in this policy and in the Chrome Web Store privacy disclosures before the changed version is distributed.

## Contact

Questions or privacy requests can be submitted through the project's GitHub issue tracker:

https://github.com/MooNFrosTec/sentinel-owner-alert/issues
