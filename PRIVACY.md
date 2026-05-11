# Privacy Policy — Design Snap

_Last updated: May 2025_

## Overview

Design Snap is a Chrome extension that extracts design tokens (colors, typography, spacing, CSS variables) from web pages, and lets you inspect elements and download media. It works entirely **locally in your browser**. No data ever leaves your device.

## Data collected

**Design Snap does not collect, store, transmit, or share any personal data.**

- The extension reads the visual styles (colors, fonts, shadows, CSS custom properties) and DOM structure of the **currently active tab** solely to display results in the popup.
- This analysis happens **locally in your browser tab**. No results are sent anywhere.
- Media downloads are saved directly to your local disk using the browser's download API or the File System Access API. No copy is made elsewhere.

## Permissions used

| Permission | Why |
|---|---|
| `activeTab` | Read the styles of the current page when you click the extension icon |
| `scripting` | Inject the content script on pages that were already open before installation |
| `downloads` | Save media files to your local Downloads folder as a fallback |

No other permissions are requested. The extension does not use network requests to external servers, analytics services, or any third-party libraries.

## Third-party services

None. The extension has zero external dependencies and makes no outbound network requests on its own.

## Changes to this policy

If the extension is ever updated in a way that affects data handling, this policy will be updated accordingly and a new version will be published on the Chrome Web Store.

## Contact

For questions or concerns, open an issue on [GitHub](https://github.com/hdif004/DesignSnap/issues).
