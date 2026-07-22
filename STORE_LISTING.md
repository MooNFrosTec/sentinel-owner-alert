# Chrome Web Store submission copy

Use this document when completing the Chrome Web Store Developer Dashboard. Keep the dashboard answers synchronized with `PRIVACY.md` and the extension's actual behavior.

## Store listing

**Product name**

Sentinel Owner Alert

**Summary**

Monitors visible Microsoft Sentinel incidents and alerts when they match configured owner, severity, and schedule rules.

**Category**

Productivity

**Language**

English

**Detailed description**

Sentinel Owner Alert monitors incident rows currently visible on the Microsoft Sentinel Incidents page and provides local sound and desktop notifications when an incident matches user-configured rules.

Main features:

- monitor incidents assigned to a configured owner;
- filter notifications by severity and working hours;
- use the bundled alert sound or upload a custom sound stored locally;
- show scanner health, visible incident counts, and recently observed incidents;
- detect a disabled Microsoft Sentinel auto-refresh control and optionally display a warning;
- open the relevant Microsoft Sentinel tab when a desktop notification is clicked.

The extension reads only information already visible in the Microsoft Sentinel interface. It does not call Microsoft Sentinel APIs, send data to external servers, include advertising, or use analytics or tracking.

Because Microsoft Sentinel uses virtualized tables, the extension can monitor only rows currently loaded into the page DOM.

**Support URL**

https://github.com/MooNFrosTec/sentinel-owner-alert/issues

**Homepage URL**

https://github.com/MooNFrosTec/sentinel-owner-alert

**Privacy policy URL**

https://github.com/MooNFrosTec/sentinel-owner-alert/blob/main/PRIVACY.md

If the policy is not yet present on `main`, use the equivalent URL for the published branch temporarily, then update this field after merging.

## Privacy practices

**Single purpose**

Monitor visible Microsoft Sentinel incidents and notify the user when an incident matches configured owner, severity, and working-hours rules.

**Permission justification: storage**

Stores user-selected monitoring settings, an optional custom sound, and recent scanner status locally. Temporary notification navigation targets are stored for the current browser session.

**Permission justification: notifications**

Displays user-configured desktop notifications when a visible Microsoft Sentinel incident matches the configured monitoring rules or when the user enables an auto-refresh warning.

**Host permission justification: `https://portal.azure.com/*`**

Required to run the content script on the Microsoft Azure Portal, read incident rows currently visible in the Microsoft Sentinel Incidents interface, detect the visible auto-refresh state, and show an optional warning banner. No other website origins are accessed.

**Remote code**

No. All executable JavaScript is included in the submitted extension package. The extension does not download or execute remote code.

**Data use disclosures**

Disclose at least:

- Website content: Microsoft Sentinel incident fields and the visible auto-refresh state are processed locally.
- Personally identifiable information: owner names, usernames, or incident text may contain identifying information depending on the user's Sentinel workspace.

State that data:

- is used only for the extension's single monitoring purpose;
- is not sold or transferred to third parties;
- is not used for advertising, creditworthiness, analytics, or unrelated purposes;
- is not transmitted off the user's device;
- is not made available for human review by the developer.

## Distribution

Recommended initial visibility: **Unlisted**.

## Reviewer notes

The extension requires access to an authenticated Microsoft Sentinel environment to demonstrate live incident scanning. Reviewers without such access can still open the popup, configure settings, upload or test a sound, and test a desktop notification. The source contains no external API calls or remote code. Live scanning operates only on incident rows already rendered by Microsoft Sentinel in `portal.azure.com`.

## Required visual assets

- Store icon: `icon128.png` (128x128).
- At least one sanitized screenshot: 1280x800 preferred, or 640x400.
- Optional small promotional tile: 440x280.
- Optional marquee image: 1400x560.

Do not use screenshots containing real incident titles, email addresses, tenant names, subscription IDs, workspace names, or other organization-sensitive information. Use a test tenant or redact/mock all such values before upload.
